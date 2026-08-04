#!/usr/bin/env bash
# Smoke-test the global CLI installation end-to-end.
#
# Intended to run inside a plain node:20 Docker container with a fresh clone of
# the repo at /dude (or the path given by $1).  The script:
#   1. Activates the right pnpm version via corepack
#   2. Installs workspace deps and builds all packages
#   3. Links the dude CLI globally with pnpm link --global
#   4. Verifies the binary is discoverable on PATH
#   5. Asserts the expected commands appear (and stack-only commands do not)
#
# Usage (inside container):
#   bash /dude/scripts/test-global-install.sh [/dude]
set -euo pipefail

REPO="${1:-/dude}"

header() { printf '\n\033[1;34m=== %s ===\033[0m\n' "$*"; }
ok()     { printf '\033[0;32m✓ %s\033[0m\n' "$*"; }
fail()   { printf '\033[0;31m✗ FAIL: %s\033[0m\n' "$*" >&2; exit 1; }

header "Environment"
echo "Node:     $(node --version)"
echo "Platform: $(uname -s)"
echo "Repo:     $REPO"

# ── 1. pnpm via corepack ────────────────────────────────────────────────────
header "Activating pnpm"
corepack enable
PNPM_VERSION="$(node -e "process.stdout.write(require('$REPO/package.json').packageManager.split('@')[1])")"
corepack prepare "pnpm@${PNPM_VERSION}" --activate
echo "pnpm $(pnpm --version)"

# ── 2. Install deps and build ───────────────────────────────────────────────
header "Installing dependencies and building"
cd "$REPO"
pnpm install --frozen-lockfile
pnpm run build
ok "build complete"

# ── 3. Global link ──────────────────────────────────────────────────────────
header "Linking dude globally"
cd "$REPO/packages/dude"
pnpm link --global
ok "pnpm link --global succeeded"

# pnpm link places shims in global node_modules/.bin, not in PNPM_HOME.
GLOBAL_ROOT="$(pnpm root -g)"
GLOBAL_BIN="${GLOBAL_ROOT}/.bin"
echo "pnpm root -g : $GLOBAL_ROOT"
echo "bin dir      : $GLOBAL_BIN"
echo "bin contents : $(ls "$GLOBAL_BIN" 2>/dev/null | tr '\n' ' ')"
export PATH="${GLOBAL_BIN}:${PATH}"

# ── 4. Binary is on PATH ────────────────────────────────────────────────────
header "Checking PATH"
if ! which dude > /dev/null 2>&1; then
  fail "dude not found on PATH (searched: $PATH)"
fi
ok "dude found at: $(which dude)"

# ── 5. dude help (no project context) ─────────────────────────────────────
# Without a dude.json in scope, only core commands (init, upgrade) appear.
# Stack commands (up, down, …) are loaded dynamically from the project's
# pinned stack plugin and must NOT appear here.
header "Running dude help (global — no project context)"
HELP="$(dude help 2>&1)"
echo "$HELP"

dude help > /dev/null 2>&1 || fail "dude help exited non-zero"
ok "dude help exits 0"

# Assert on command NAMES from the catalog, not substrings of the rendered page:
# descriptions legitimately mention words like "format" (e.g. `help` documenting
# its own `--format` flag), which makes a grep over the whole page a false
# positive. `--format json` is the machine-readable form of the same catalog.
catalog_names() {
  # Capture first so a real crash of `dude help --format json` produces a named
  # failure instead of a bare `SyntaxError: Unexpected end of JSON input` from
  # JSON.parse(""), which reads as a parser bug rather than a broken CLI.
  local json
  json="$(dude help --format json 2>/dev/null)" \
    || fail "dude help --format json exited non-zero"
  [ -n "$json" ] || fail "dude help --format json produced no output"
  printf '%s' "$json" | node -e '
    let s = ""
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const j = JSON.parse(s)
      const names = [
        ...j.commands.map((c) => c.name),
        ...j.groups.map((g) => g.name),
        ...(j.projectCommands ?? []).map((c) => c.name),
      ]
      process.stdout.write(names.join("\n") + "\n")
    })'
}

GLOBAL_NAMES="$(catalog_names)"

for cmd in init upgrade version info report help; do
  echo "$GLOBAL_NAMES" | grep -qx "$cmd" || fail "core command '$cmd' is missing from the catalog"
  ok "catalog lists core command '$cmd'"
done

for cmd in up down logs shell lint format review; do
  echo "$GLOBAL_NAMES" | grep -qx "$cmd" && fail "'dude help' unexpectedly shows stack command '$cmd' outside a project" || true
  ok "global help does not contain stack command '$cmd'"
done

# ── 6. Full customer chain: init → lint ─────────────────────────────────────
# Scaffold a project from the bundled stack and lint it, driving the installed
# binary exactly as a user would. Uses the postgres + celery options so the
# template overlays are exercised too. (No uv/docker needed: lint is pure Node.)
header "Scaffolding a project (dude init)"
PROJECT_DIR="$(mktemp -d)/app"
dude init --stack "$REPO/stacks/react-fastapi" --yes --database postgres --celery "$PROJECT_DIR" \
  || fail "dude init exited non-zero"
[ -f "$PROJECT_DIR/dude.json" ] || fail "init did not produce dude.json"
[ -f "$PROJECT_DIR/backend/app/models/user.py" ] || fail "postgres overlay not applied"
[ -f "$PROJECT_DIR/backend/app/worker.py" ] || fail "celery overlay not applied"
ok "project scaffolded at $PROJECT_DIR"

header "dude help (project context)"
cd "$PROJECT_DIR"
PROJECT_HELP="$(dude help 2>&1)"
echo "$PROJECT_HELP"

PROJECT_NAMES="$(catalog_names)"

for cmd in up down logs shell lint format review cheatsheet; do
  echo "$PROJECT_NAMES" | grep -qx "$cmd" || fail "'dude help' from project is missing stack command '$cmd'"
  ok "project help contains '$cmd'"
done

# The db group only exists because this scaffold chose --database postgres; iac
# was never enabled, so its absence proves the catalog is answer-aware.
echo "$PROJECT_NAMES" | grep -qx "db" || fail "the db group is missing despite --database postgres"
ok "catalog is answer-aware: db present"
echo "$PROJECT_NAMES" | grep -qx "iac" && fail "the iac group appeared without --iac" || true
ok "catalog is answer-aware: iac absent"

header "dude cheatsheet (project context)"
dude cheatsheet --format json > /tmp/cheatsheet.json 2>/dev/null \
  || fail "dude cheatsheet --format json exited non-zero"
node -e '
  const j = JSON.parse(require("node:fs").readFileSync("/tmp/cheatsheet.json", "utf8"))
  if (j.schema !== "dude.cheatsheet/1") throw new Error("unexpected schema: " + j.schema)
  if (!Array.isArray(j.rules) || j.rules.length === 0) throw new Error("no lint rules harvested")
  if (!j.verify.includes("dude lint")) throw new Error("verify loop is missing dude lint")
  if (!j.catalog?.commands?.length) throw new Error("catalog not embedded")
' || fail "dude cheatsheet --format json produced an unusable payload"
ok "cheatsheet json carries schema, rules, verify loop and the embedded catalog"

header "Linting the scaffold (dude lint)"
dude lint || fail "dude lint exited non-zero on a fresh scaffold"
ok "dude lint exits 0 on the fresh scaffold"

header "All global install checks passed"
