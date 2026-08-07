# Contributing to dude

This guide is for people working in this monorepo on the CLI runtime, the
launcher, and the stack plugins. For using `dude` to scaffold projects, see the
[README](README.md) and the [docs site](docs/) (`make docs`). For the full
command reference and repo invariants, see [CLAUDE.md](CLAUDE.md).

---

## What's in here

| Directory                 | npm name                            | Role                                                           |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `packages/dude/`          | `@cubocicloide/dude`                | CLI runtime — `init`, `upgrade`, `info`, `help`, dispatch      |
| `packages/dude-launcher/` | `@cubocicloide/dude-launcher`       | Tiny global shim; runs each project's pinned CLI + stack       |
| `stacks/*/`               | `@cubocicloide/stack-*`             | Stack plugins: templates, lint rules, generators, IaC, commands |

Everything is TypeScript + ESM. Toolchain: **pnpm workspaces**, **Turbo**, **tsup**.

---

## Repo layout

```
dude/
├── packages/
│   ├── dude/                 # CLI runtime
│   │   └── src/
│   │       ├── cli.ts        # citty entry point, command dispatch
│   │       ├── commands/     # init, upgrade, info, help, …
│   │       └── core/         # config, registry, stack-loader, template-runner
│   └── dude-launcher/        # global shim
├── stacks/
│   └── <stack>/
│       ├── src/
│       │   ├── index.ts      # stack contract (commands, answers, context)
│       │   └── commands/     # lint, api, db, iac, …
│       └── templates/        # template overlays (base/ + conditional overlays)
└── docs/                     # this repo's MkDocs site (make docs)
```

---

## Prerequisites

- Node ≥ 20.19 and `pnpm`. All `@cubocicloide/*` packages are on the public npm
  registry, so no token is needed to install.
- For exercising the IaC overlay end-to-end: `terraform`, `kubectl`, `helm`,
  `docker`, and the `aws` CLI with credentials.

---

## Build & run from source

```bash
make install              # pnpm install (whole workspace)
make build                # turbo build — every package via tsup
make cli ARGS="--help"    # run the locally-built CLI

# Faster single-package rebuilds during iteration:
pnpm --filter @cubocicloide/dude build
pnpm --filter @cubocicloide/stack-react-fastapi build
```

> Never edit anything under `dist/` — it is overwritten on every build. Always
> rebuild after changing source.

---

## Dev scaffold loop

The standard way to validate template, lint, command, or IaC changes is to
scaffold a throwaway project into `private/examples/` (gitignored) and drive the
real binary against it.

```bash
# Scaffold a fresh project from the local stack (full overlay matrix by default)
make dev-init

# A subset:
make dev-init STACK_OPTS="--database postgres"

# Run a command inside the scaffold (uses the linked local binary, not the
# published CLI — so it always exercises your local source):
make dev-run ARGS="lint"
make dev-run ARGS="help"

# Iterate without rescaffolding: rebuild the stack, then re-run.
pnpm --filter @cubocicloide/stack-react-fastapi build
make dev-run ARGS="lint"
```

`make dev-init` tears down any previous scaffold, rebuilds the CLI **and** stack,
scaffolds into `private/examples/test-local/`, links the local `dude` binary, and
installs `frontend/` + `e2e/` dev deps so `dude review` works immediately.

### Exercising the IaC overlay locally

The IaC overlay is part of the default `STACK_OPTS` matrix, but you can scope to
just it. IaC commands need the `aws` CLI + credentials.

```bash
make dev-init STACK_OPTS="--iac aws-eks"          # or the full matrix
make dev-run ARGS="help iac"                       # iac sub-commands + flags

# A typical end-to-end run (see iac/README.md in the scaffold for the contract):
make dev-run ARGS="iac login     --env dev"
make dev-run ARGS="iac bootstrap --state-bucket-prefix <your-org> --env dev --yes"
make dev-run ARGS="iac init      --env dev"
make dev-run ARGS="iac apply     --env dev"
make dev-run ARGS="iac kubeconfig --env dev"
make dev-run ARGS="iac ship       --env dev"       # build + push + deploy
make dev-run ARGS="iac destroy    --env dev --yes"
```

---

## Make targets

The Makefile is self-documenting — **`make help`** lists every target grouped by
section. The ones you'll reach for most:

| Target            | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `make install`    | Install all workspace dependencies                                   |
| `make build`      | Build every package via turbo                                        |
| `make dev`        | Watch + rebuild all packages (keep running for HMR)                  |
| `make cli ARGS=…` | Run the local CLI, e.g. `make cli ARGS="init --stack react-fastapi"` |
| `make dev-init`   | Tear down + re-scaffold + relink `private/examples/test-local/`      |
| `make dev-run`    | Run a command inside the scaffold, e.g. `ARGS="lint"`                |
| `make docs`       | Serve this repo's docs site at http://localhost:8001                 |
| `make test`       | Run every suite (CLI runtime + stack)                                |
| `make test-stack` | Test the stack package only                                          |
| `make check`      | `lint + typecheck + test` — the CI pre-flight                        |
| `make changeset`  | Record a changeset for the next release                              |
| `make promote`    | Promote a published version to stable — `PKG=<name> [VERSION=<v>]`   |
| `make dist-tags`  | Show the release channels of every publishable package               |
| `make clean`      | Remove `dist/`, `node_modules/`, `.turbo/`                           |

---

## Testing

Each package mixes **unit** tests (pure functions / lint rules) and
**integration** tests (scaffold a real project in a tmpdir and drive the built
binary, exactly like a customer). Integration tests spawn `dist/`, so the
`test*` targets rebuild first.

```bash
make test               # everything
make test-stack         # stack only
make test-watch-stack   # watch mode (pair with `make dev`)
make test-install       # smoke-test the globally-installed binary in Docker (mirrors CI)
```

Run `make check` before opening a PR.

---

## Releasing

Releases move through **two channels**, implemented as npm dist-tags on
npmjs.com:

| Channel   | dist-tag | Who gets it                                                                 |
| --------- | -------- | --------------------------------------------------------------------------- |
| Candidate | `next`   | Opt-in only: `dude init --next`, `dude upgrade --next`, `DUDE_CHANNEL=next` |
| Stable    | `latest` | Everyone by default (`dude init`, `dude upgrade`, `npm i`)                  |

**1. Publish a candidate** — record intent; CI does the rest:

```bash
make changeset    # interactively record a version bump (patch/minor/major)
# → push; CI opens a "Version Packages" PR
# → merging that PR publishes to npmjs.com under the `next` dist-tag
```

At this point `latest` has **not** moved: existing users are untouched.

**2. Verify the candidate** — scaffold from the registry (outside this repo,
so the workspace checkout doesn't shadow the published package) and exercise
it:

```bash
cd "$(mktemp -d)"
dude init my-check --stack react-fastapi --next --yes
cd my-check && pnpm install && dude lint
```

**3. Promote to stable** — once the candidate has proven itself (needs npm
publish auth on the `@cubocicloide` scope; `make promote`/`make dist-tags` use
`NPM_TOKEN` from a repo-root `.env`, gitignored, falling back to your `npm login`):

```bash
make promote PKG=stack-react-fastapi          # promote what `next` points to
make promote PKG=dude VERSION=0.15.0          # or a specific version
make dist-tags                                # inspect all channels
```

Promotion only moves the `latest` dist-tag — nothing is republished. Rollback
is the same command pointed at the previous version.

`make release` exists for emergency/manual publishes only — CI handles the
normal path (and it, too, publishes to `next`).

---

## Issue triage & automation

Repo maintenance is split into two halves by design.

**Deterministic, always-on (GitHub Actions — free on a public repo, no AI):**

- **Stale bot** (`.github/workflows/stale.yml`) ages out issues/PRs with no
  activity for 60 days (closes after a further 14). Exempt via the `pinned`,
  `security`, or `roadmap` labels, a milestone, or an assignee.
- **Dependabot** (`.github/dependabot.yml`) opens weekly, grouped dependency
  and GitHub-Actions update PRs.
- **Greetings** (`.github/workflows/greetings.yml`) welcomes first-time
  contributors.

**On-demand AI, run locally by maintainers (your own Claude session):**

The intelligent work — triage, duplicate detection, and fixing — runs on a
maintainer's machine, invoked by hand. There is no hosted AI bot: each
maintainer or contributor uses their **own** Claude account, so the cost is
shared rather than centralised, and untrusted issue text never drives an
automated action in CI.

- **`triage-issues`** skill — work through the `triage`-labelled backlog:
  assess validity, find duplicates, apply `stack:*` / `needs-repro` labels.
  It proposes actions and waits for your approval; it never closes a valid
  issue on its own.
- **`fix-issues`** skill + **`issue-fixer`** agent — implement a chosen issue in
  an isolated git worktree and open a PR for review. Never auto-merged.
- **`review-prs`** skill + **`pr-reviewer`** agent — review open PRs and issue a
  verdict, posted as a formal GitHub review with inline comments. It routes by
  PR class (dependabot bump, "Version Packages" release PR, fork contributor,
  internal branch) and by affected stack, and checks the repo's invariants
  against the diff rather than against the PR description. The reviewer agent is
  read-only: it never modifies a PR's code. Merging is gated — only a low-risk
  dependabot bump with green CI merges unattended, and a Release PR never does.

A typical session: run `triage-issues` to clean and label the backlog, hand the
ready ones to `fix-issues`, then `review-prs` on what comes back.

For a **dependency PR** specifically, `review-prs` encodes the two checks that
actually matter here: for a GitHub-Actions bump it fetches the upstream
`action.yml` at the new tag and diffs the declared inputs against the ones our
workflow passes (a renamed input is a silent no-op, not an error); for an npm
bump it distinguishes a build-time `devDependency` from something that ships in
a published package, and flags `@types/node` majors that drift ahead of
`engines: node >=20`.

> **Promoting triage to CI later.** If issue volume outgrows on-demand triage,
> the same logic can move into GitHub Actions via `anthropics/claude-code-action`
> with an `ANTHROPIC_API_KEY` secret — always-on, but metered and requiring
> care with untrusted input. Keep destructive/expensive actions (auto-fix,
> closing) gated behind a maintainer label or `@claude` mention, never
> auto-triggered on a public event. Enable **CodeQL** (default setup, Settings →
> Security) and **secret scanning + push protection** at go-public time.

---

## End-user documentation lives in the templates

The documentation that ships _inside generated projects_ — the full `dude` API
reference your users read via `dude docs` — is authored under each stack's
`templates/base/docs/` (plus the IaC overlay's `docs/` for the deploy guide).
**When you add or change a command, update that documentation in the same
change** so the rendered docs stay in sync. This is separate from the repo's own
`docs/` site (served by `make docs`), which explains `dude` itself.

See [CLAUDE.md](CLAUDE.md) for the full command reference and contributor
invariants.
