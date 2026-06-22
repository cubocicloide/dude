# dude

> Cubocicloide's project scaffolding & code-quality CLI.
> Multi-stack, plugin-based, distributed via GitHub Packages.

---

## Using dude

### Prerequisites

- **Docker Desktop** running.
- **Node.js ≥ 20** and **pnpm**.
- A GitHub [personal access token](https://github.com/settings/tokens) with
  `read:packages` — `dude` ships as a private GitHub Package.

  Add to `~/.npmrc`:

  ```ini
  @cubocicloide:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
  ```

  Export from your shell profile:

  ```bash
  export GITHUB_TOKEN=ghp_your_token_here
  ```

### Scaffold a new project

```bash
# 1. Install the launcher globally — the only global install.
npm install -g @cubocicloide/dude-launcher

# 2. Scaffold.
dude init my-app
cd my-app

# 3. Provision the pinned toolchain (CLI + stack) from the lockfile.
pnpm install

# 4. First run — build images and start every service.
dude up
```

From the second run onward: `dude up`. Stop everything: `dude down`.

### Services (default ports)

| Service    | URL                            |
| ---------- | ------------------------------ |
| Frontend   | http://localhost:5173          |
| API        | http://localhost:8000          |
| Swagger UI | http://localhost:8000/api/docs |
| Docs site  | http://localhost:8001          |

### Next

```bash
dude help          # live command catalog (reflects your dude init choices)
dude docs          # browse the full docs at http://localhost:8001
```

The docs site is the primary reference for all commands, workflows, and
optional features (database, Celery, IaC). Run `dude help --format md` to
print the full catalog as Markdown.

---

## For maintainers

The rest of this file is for people working in this monorepo on the CLI
runtime, the launcher, and the stack plugins.

---

## What's in here

| Directory                 | npm name                            | Role                                                           |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `packages/dude/`          | `@cubocicloide/dude`                | CLI runtime — `init`, `upgrade`, `help`, and command dispatch  |
| `packages/dude-launcher/` | `@cubocicloide/dude-launcher`       | Tiny global shim; runs each project's pinned CLI + stack       |
| `stacks/react-fastapi/`   | `@cubocicloide/stack-react-fastapi` | Stack plugin: templates, lint rules, generators, IaC, commands |

Everything is TypeScript + ESM. Toolchain: **pnpm workspaces**, **Turbo**, **tsup**.

---

## Repo layout

```
dude/
├── packages/
│   ├── dude/                 # CLI runtime
│   │   └── src/
│   │       ├── cli.ts        # citty entry point, command dispatch
│   │       ├── commands/     # init, upgrade, help, …
│   │       └── core/         # config, registry, stack-loader, template-runner
│   └── dude-launcher/        # global shim
└── stacks/
    └── react-fastapi/
        ├── src/
        │   ├── index.ts      # stack contract (commands, answers, context)
        │   └── commands/     # lint, api, db, iac, …
        └── templates/        # template overlays (see below)
            ├── base/         # always applied — includes the end-user docs/
            ├── postgres/     # --database postgres
            ├── celery/       # --celery
            ├── celerybeat/   # --celerybeat
            └── aws-eks/      # --iac aws-eks (Terraform + Helm + deploy docs)
```

---

## Prerequisites

- Node ≥ 20, `pnpm`, and (for installing the private deps) a `GITHUB_TOKEN`
  with `read:packages`:

  ```bash
  export GITHUB_TOKEN=ghp_xxx
  ```

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
# global launcher — so no GITHUB_TOKEN round-trip):
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
| `make test`       | Run every suite (CLI runtime + stack)                                |
| `make test-stack` | Test the stack package only                                          |
| `make check`      | `lint + typecheck + test` — the CI pre-flight                        |
| `make changeset`  | Record a changeset for the next release                              |
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

```bash
make changeset    # interactively record a version bump (patch/minor/major)
# → push; CI opens a "Version Packages" PR
# → merging that PR publishes to GitHub Packages automatically
```

`make release` exists for emergency/manual publishes only — CI handles the
normal path.

---

## End-user documentation lives in the templates

The documentation that ships _inside generated projects_ — the full `dude` API
reference your users read via `dude docs` — is authored under
[`stacks/react-fastapi/templates/base/docs/`](stacks/react-fastapi/templates/base/docs/)
(plus [`stacks/react-fastapi/templates/aws-eks/docs/`](stacks/react-fastapi/templates/aws-eks/docs/)
for the IaC deploy guide). **When you add or change a command, update that
documentation in the same change** so the rendered docs stay in sync. See
[CLAUDE.md](CLAUDE.md) for the full command reference and contributor invariants.

---

## License

Proprietary — © Cubocicloide. Internal use only.
