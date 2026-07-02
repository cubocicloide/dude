# CLAUDE.md — dude monorepo

This file gives Claude the context it needs to work effectively in the `dude`
monorepo. Read it fully before making changes.

---

## What this repo is

**dude** is a monorepo that ships these packages:

| Package                  | npm name                            | Purpose                                                                               |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/dude/`         | `@cubocicloide/dude`                | The CLI runtime — `dude init`, `dude lint`, `dude up`, …                              |
| `packages/dude-launcher/`| `@cubocicloide/dude-launcher`       | Tiny global shim; runs each project's pinned CLI + stack (the only global install)    |
| `stacks/react-fastapi/`  | `@cubocicloide/stack-react-fastapi` | A stack plugin that teaches `dude` how to scaffold and lint a React + FastAPI project |
| `stacks/fastmcp/`        | `@cubocicloide/stack-fastmcp`       | Stack plugin for a FastMCP (Python) server — modular MCP feature sub-servers          |
| `stacks/tauri/`          | `@cubocicloide/stack-tauri`         | Stack plugin for a Tauri 2 desktop app — React + Ant Design frontend, Rust backend    |

Everything is TypeScript + ESM. Toolchain: **pnpm workspaces**, **Turbo**, **tsup**.

---

## Repo layout

```
dude/
├── packages/
│   └── dude/                   # CLI runtime
│       ├── src/
│       │   ├── cli.ts           # citty entry point, registers all commands
│       │   ├── commands/        # init, up, down, logs, shell, lint, api, docs, …
│       │   ├── core/            # config, registry, stack-loader, template-runner, …
│       │   └── utils/
│       └── bin/
│           └── dude.mjs         # ESM shim — the installed binary
├── stacks/
│   └── react-fastapi/           # Stack plugin for React + FastAPI
│       ├── src/
│       │   ├── index.ts         # stack entry point (exports stack contract)
│       │   └── commands/
│       │       └── lint/
│       │           └── checks/  # lint rule modules (see below)
│       │               ├── BE/  # backend checks (BE001–BE011)
│       │               ├── FE/  # frontend checks
│       │               └── E2E/ # e2e checks
│       └── templates/           # template overlays
│           ├── base/            # base overlay — always applied
│           ├── postgres/        # overlay — applied when withPostgres = true
│           ├── celery/          # overlay — applied when withCelery = true
│           └── celerybeat/      # overlay — applied when withCeleryBeat = true
│   ├── fastmcp/                 # Stack plugin for a FastMCP (Python) server
│   └── tauri/                   # Stack plugin for a Tauri 2 desktop app (React + antd + Rust)
│       ├── src/commands/        # dev, build, doctor, icon, lint (FE/BE checks), format, review, test, docs
│       └── templates/           # base/ (always) + sqlite/ (when --database sqlite)
├── Makefile                     # top-level developer targets (see below)
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Build

```bash
make install          # install all workspace deps (pnpm install)
make build            # build everything via turbo (tsup for each package)
make cli ARGS="…"     # run the locally-built CLI
```

Single-package builds (faster during iteration):

```bash
pnpm --filter @cubocicloide/dude build
pnpm --filter @cubocicloide/stack-react-fastapi build
```

> Never edit anything under `dist/`. Always rebuild after source changes.

### Stack resolution in a source checkout

When the globally installed `@cubocicloide/dude-launcher` is used from within
the repo clone itself (e.g. running `dude init` inside `/path/to/dude`), the
stack-loader's workspace-scan fallback will locate `stacks/<name>/` but
`dist/index.js` will be absent in a fresh checkout. The CLI detects this and
emits an explicit error:

```
Stack entry point not found: <path>/dist/index.js

This stack was resolved from a local source-checkout (pnpm workspace).
The package has not been built yet. Run one of the following to compile it:

  pnpm --filter <pkg-name> build   # build only this stack
  make build                        # build the entire monorepo

After building, re-run your dude command.
```

**Resolution order** (`loadStack`):
1. Explicit filesystem path (spec starts with `.` or `/`).
2. Node's `require.resolve` — finds the package in project `node_modules` (normal installed use).
3. pnpm-workspace scan — walks up from `cwd` and from the CLI package dir looking for `pnpm-workspace.yaml`, then matches by `package.json` `name`. This is the source-checkout path.
4. Cache install — downloads the package to `~/.dude/cache/stacks/` via npm.

---

## Template system

Each stack ships one or more **template overlays**. `dude init` copies them in
order (base → postgres → celery → celerybeat), with later overlays winning on
conflict.

- Plain files are copied verbatim.
- Files ending in `.hbs` are processed with **Handlebars** and the `.hbs` suffix
  is stripped from the output filename.
- **Boolean context variables** available in every `.hbs` file:
  `withPostgres`, `withCelery`, `withCeleryBeat`, `withRedis`, `withIac`
  (true when `--iac aws-eks`). `projectName` is also available.

Overlays live under `stacks/<stack>/templates/` (`base`, `postgres`, `celery`,
`celerybeat`, `aws-eks`). The `aws-eks` overlay is applied when `--iac aws-eks`
and adds `iac/` (Terraform + Helm), prod Dockerfiles, and the deploy docs page.
To add a new file to the base scaffold, drop it in
`stacks/react-fastapi/templates/base/`. To add a file that only appears when
Celery is enabled, drop it in `templates/celery/`; for IaC-only files, use
`templates/aws-eks/` (or guard a base `.hbs` file with `{{#if withIac}}`).

---

## Lint check architecture

Each lint rule is a TypeScript module in `stacks/react-fastapi/src/commands/lint/checks/{BE,FE,E2E}/NNN.ts`.
Modules are auto-discovered by the build and loaded at runtime — no registration step.

Every lint rule must have a matching prose description in the **generated project's**
`.claude/rules/` directory:
`stacks/react-fastapi/templates/base/.claude/rules/{BE,FE,E2E}/NNN.md`

**Rule**: when you add or change a lint check, update the corresponding
`.claude/rules` file in the template so generated projects stay in sync.

### Adding a new lint check

1. Create `src/commands/lint/checks/BE/NNN.ts` (copy an existing one for structure).
2. Export a default function `check(projectRoot: string): LintResult[]`.
3. Add `templates/base/.claude/rules/BE/NNN.md` describing what the rule enforces and
   how to fix violations.
4. Rebuild the stack: `pnpm --filter @cubocicloide/stack-react-fastapi build`
5. Scaffold + verify: `make dev-init && dude lint` (see dev loop below).

---

## Dev scaffold loop

The standard way to validate template + lint changes:

```bash
# Scaffold a fresh test project (lands in private/examples/test-local/)
make dev-init

# Or with options:
make dev-init STACK_OPTS="--database postgres --celery --celerybeat"

# Run lint checks against the scaffold
cd private/examples/test-local
dude lint
```

`private/` is gitignored — test scaffolds are ephemeral.

---

## Command resolution

`dude <cmd>` is resolved with precedence **project-custom > stack > core**:

1. **Project-custom** — files under the project's `.dude/commands/` directory.
   Loaded by `packages/dude/src/core/custom-commands.ts` (via **jiti**, so
   users can author `.ts` and import project deps). One file = one command,
   named after the file. Reserved names (`init`, `upgrade`, `version`, `help`)
   cannot be overridden.
2. **Stack** — commands declared by the active stack plugin (`definition.commands`).
3. **Core** — `init`, `upgrade`, `version`, `help` defined in `cli.ts`.

The dispatcher lives in `packages/dude/src/cli.ts` (`tryProjectDispatch`); the
merged catalog for `dude help` is built in `packages/dude/src/commands/help/index.ts`.
The hello-world example + contract docs are shipped from the stack template at
`stacks/react-fastapi/templates/base/.dude/commands/`.

---

## Command reference

This is the full catalog as of the current `react-fastapi` stack. Which commands
appear in a given project depends on the init answers: `db` requires
`--database postgres`, the Flower monitor requires `--celery`, and the `iac`
group requires `--iac aws-eks`. `dude help` always reflects the live, resolved
set (core + active stack + project-custom). Keep this table and the end-user docs
(`templates/base/docs/`, `templates/aws-eks/docs/`) in sync when commands change.

### Core (CLI runtime — always present)

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude init [<dir>]` | `--stack <id>`, `--yes`, `--database postgres`, `--celery`, `--celerybeat`, `--iac aws-eks` | Scaffold a new project. Stack-answer flags (`--database`, …) make it non-interactive; `--yes` accepts all defaults. |
| `dude upgrade` | `--cli`, `--stack`, `--cli-version <v>`, `--stack-version <v>` | Move the CLI and/or stack pin (in `package.json` **and** `dude.json`). Run `pnpm install` after. Does not migrate files. |
| `dude version` | — | Print the resolved CLI + stack versions. |
| `dude help [group] [cmd]` | `--format md\|json` | Live merged catalog; `dude help <group> <sub>` shows a subcommand's flags. `--format md\|json` emits the whole catalog (used to generate the docs `api.md`). |

### Infrastructure (Docker Compose)

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude up` | `--build` | `docker compose up -d`; `--build` rebuilds images first. |
| `dude down` | — | Stop and remove containers. |
| `dude logs [service]` | — | Follow logs; omit `service` for all. |
| `dude shell <service>` | — | Interactive shell in a running container. |

### Code quality

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude lint` | — | Run all stack structural checks (BE/FE/E2E conventions). |
| `dude format` | — | `ruff format` (backend) + `prettier` (frontend). |
| `dude review` | — | lint + ESLint + API-contract review in one pass. |

### API contract (OpenAPI)

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude api sync` | — | Fetch the OpenAPI spec from the running backend → regenerate the typed client. |
| `dude api review` | — | Validate `frontend/src/openapi/` against the saved spec. |

### Database — requires `--database postgres`

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude db makemigration` | `--message <text>` | Generate a new Alembic migration (autogenerate). |
| `dude db migrate` | `--revision <rev>` (default `head`) | Apply pending migrations. |
| `dude db rollback` | `--revision <rev>` (default `-1`) | Downgrade by one revision. |

### Testing

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude test` | `--backend`, `--e2e`, `--headed`, `--report` | Run suites. No flag → all; `--headed` shows the browser; `--report` writes HTML+JSON to `e2e/reports/`. |

### Security scanning

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude security scan` | `--only <s,…>`, `--min-severity <LVL>`, `--fail-on <LVL>`, `--update-baseline` | Run scanners (bandit, semgrep, trivy-fs, trivy-image); fail on new findings ≥ threshold. |
| `dude security accept` | — | Re-scan and absorb all findings into `security/baseline.json`. |
| `dude security verify` | `--rule-id <ids>`, `--remove-resolved` | Confirm specific findings are fixed; prune resolved ones from the baseline. |

### Documentation

| Command | Flags | Meaning |
| ------- | ----- | ------- |
| `dude docs` | `--port <n>` | Serve `docs/` (MkDocs Material) at http://localhost:8001. |

### Infrastructure as code — requires `--iac aws-eks`

Every `iac` command is **environment-scoped via `--env <name>` (required, no
default)** — run any without `--env` to list the environments discovered under
`iac/terraform/environments/`. Most also accept `--profile <name>` (defaults to
`<project>-<env>`, or `$AWS_PROFILE`).

| Command | Key flags | Meaning |
| ------- | --------- | ------- |
| `dude iac login` | `--env` | Configure/verify AWS credentials (maps `--env` → an AWS profile). |
| `dude iac bootstrap` | `--state-bucket-prefix <p>` (required), `--region <r>`, `--env`, `--yes` | One-time: create the shared backend (S3 + DynamoDB) **and** ECR repos, then wire `backend.hcl`. |
| `dude iac new-env` | `--env <name>` (required), `--from <env>` (default `dev`) | Scaffold a new environment by copying an existing one. |
| `dude iac init` | `--env` | `terraform init` — (re)configures the S3 backend for the env. |
| `dude iac plan` | `--env` | `terraform plan`. |
| `dude iac apply` | `--env`, `--yes` | Provision/update infrastructure. |
| `dude iac output` | `--env`, `--json` | Print Terraform outputs (cluster, ECR URLs, RDS endpoint…). |
| `dude iac fmt` | `--env` | `terraform fmt -recursive`. |
| `dude iac validate` | `--env` | `terraform validate`. |
| `dude iac kubeconfig` | `--env` | Point `kubectl`/`helm` at the provisioned cluster. |
| `dude iac build` | `--env`, `--tag <t>`, `--platform <p>` | Build BE+FE prod images (default tag = git short SHA; default platform `linux/amd64`). |
| `dude iac push` | `--env`, `--tag`, `--platform` | ECR login + `docker push` BE+FE. |
| `dude iac deploy` | `--env`, `--tag`, `--namespace <n>` | `helm upgrade --install` (auto-wires ECR registry + image tag). |
| `dude iac ship` | `--env`, `--tag`, `--platform`, `--namespace` | build + push + deploy in one step. |
| `dude iac status` | `--env`, `--namespace` | Release status + pods. |
| `dude iac shell` | `--env` | Interactive shell inside the IaC runner container (terraform, kubectl, helm, k9s, aws), scoped to the env. |
| `dude iac destroy` | `--env`, `--yes`, `--namespace`, `--skip-helm`, `--skip-tf`, `--keep-backend` | Tear down the env (helm uninstall → ALB cleanup → Route53 cleanup → `terraform destroy`). The shared bootstrap (backend + ECR) is torn down only when no other env still uses it, unless `--keep-backend`. |

> **IaC runner (Docker).** `dude iac *` runs terraform/kubectl/helm/k9s inside a
> container built from the scaffold's `iac/runner/Dockerfile` (image tagged by a
> hash of that file). `aws` and `docker build/push` stay on the host; `login`
> stays on the host (SSO browser). Routing lives in
> `providers/aws-eks/lib/exec.ts` (wraps the generic `run`/`capture`) +
> `lib/runner.ts`. `~/.aws` + `~/.kube` are mounted in. Override with
> `DUDE_IAC_RUNNER=host`; falls back to native tools when Docker is absent.

---

## Common Makefile targets

| Target            | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `make install`    | `pnpm install` for the whole workspace                   |
| `make build`      | `turbo build` — build every package                      |
| `make dev`        | `turbo dev` — watch mode for all packages                |
| `make test`       | Run all test suites                                      |
| `make lint`       | Lint all TypeScript sources                              |
| `make typecheck`  | `tsc --noEmit` across the workspace                      |
| `make format`     | Prettier the workspace                                   |
| `make cli ARGS=…` | Run the local CLI, e.g. `make cli ARGS="lint"`           |
| `make dev-init`   | Scaffold `private/examples/test-local/` from local stack |
| `make changeset`  | Record a changeset for the next release                  |
| `make release`    | Publish to GitHub Packages                               |
| `make clean`      | Remove `dist/` and `node_modules/`                       |

## Project version pinning

Both the CLI and the stack are pinned as **devDependencies** in the scaffolded
`package.json`, so `pnpm install` provisions a reproducible toolchain from the
lockfile — the single source of truth. `dude.json` mirrors the pins (`stack`,
`stackVersion`, `dudeVersion`) for provenance and records the scaffold answers.

At runtime the CLI loads the stack from `node_modules` (its first resolution
strategy); the `~/.dude` cache is only a fallback for `dude init` on a bare
machine. `minDudeVersion` (declared by each stack) is enforced before any stack
command runs.

The **launcher** (`@cubocicloide/dude-launcher`, installed globally) makes
`dude <cmd>` run each project's pinned versions automatically: it finds the
nearest `dude.json`, provisions the toolchain if needed, and re-execs the
project-local `dude`. Different projects → different versions, no switching.

Use `dude upgrade` inside a generated project to bump either or both pins (it
updates `package.json` **and** `dude.json` in lockstep; run `pnpm install`
after):

```bash
dude upgrade
dude upgrade --cli --cli-version 0.6.1
dude upgrade --stack --stack-version 5.0.5
```

The command does not migrate scaffolded files. Rollback is done by pinning the
previous version again.

---

## Release workflow

```bash
make changeset    # interactively bump versions (patch/minor/major)
# → push; CI opens a "Version Packages" PR
# → merging that PR triggers publish to GitHub Packages automatically
```

---

## Key invariants

- **Every lint check ↔ one `.claude/rules/NNN.md`**: always keep them in sync.
- **Always rebuild after changing source**: `make build` or per-filter build.
- **Always validate with the dev scaffold loop**: change templates/lint → `make dev-init` → `dude lint`.
- **`.hbs` files get Handlebars-processed**: use `{{variable}}` syntax; plain files are copied verbatim.
- **`private/` is gitignored**: never commit test scaffolds.
- **Do not edit `dist/`**: it is overwritten by every build.

---

## Claude guidance for this repo

See `.claude/rules/` for focused rule files.
See `.claude/skills/` for step-by-step skill guides.
