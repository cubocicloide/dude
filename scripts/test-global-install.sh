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

# ── 5. dude help ───────────────────────────────────────────────────────────
header "Running dude help"
HELP="$(dude help 2>&1)"
echo "$HELP"

dude help > /dev/null 2>&1 || fail "dude help exited non-zero"
ok "dude help exits 0"

for cmd in init up down logs shell; do
  echo "$HELP" | grep -q "$cmd" || fail "'dude help' is missing '$cmd'"
  ok "help contains '$cmd'"
done

for cmd in lint format review; do
  echo "$HELP" | grep -qw "$cmd" && fail "'dude help' unexpectedly contains '$cmd'" || true
  ok "help does not contain '$cmd'"
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

header "Linting the scaffold (dude lint)"
cd "$PROJECT_DIR"
dude lint || fail "dude lint exited non-zero on a fresh scaffold"
ok "dude lint exits 0 on the fresh scaffold"

header "All global install checks passed"
