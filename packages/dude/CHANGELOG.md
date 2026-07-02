# @cubocicloide/dude

## 0.11.3

### Patch Changes

- 2ccc3a6: Add the `tauri` stack: scaffolds a Tauri 2 desktop app (React 19 + Vite +
  Ant Design frontend, Rust backend) with an optional SQLite database
  (`--database sqlite`). Ships `dev`, `build`, `doctor`, `icon`, `lint`,
  `format`, `review`, `test` and `docs` commands, plus 22 structural lint
  checks (FE001–FE011 for the React side, BE001–BE011 for Rust/Tauri best
  practices) each documented in the generated project's `.claude/rules/`.
  The CLI registry now resolves the `tauri` stack name.

## 0.11.2

### Patch Changes

- 4cad393: fix(stack-loader): improve error message when stack dist is missing in source checkout

  When the globally installed `dude-launcher` is used from within a monorepo
  source checkout and the stack package has not been compiled, the CLI now emits
  a context-sensitive error that explains the situation and provides the exact
  build command needed (`pnpm --filter <pkg> build` / `make build`).

  The `resolveStackRoot` function now tracks _how_ a stack root was found
  (Node resolution, pnpm-workspace scan, dude cache, or explicit path) and
  `loadStack` uses that information to tailor the remediation message — distinct
  guidance for workspace checkouts, installed packages, cache entries, and
  explicit paths.

  A new test file (`stack-loader.test.ts`) covers the missing-dist error paths
  for each resolution source and verifies that a properly built stack loads
  successfully.

## 0.11.1

### Patch Changes

- 2537e53: feat(fastmcp): introduce the `fastmcp` stack plugin

  Adds `@cubocicloide/stack-fastmcp` — a new official `dude` stack for Python
  MCP servers built with [FastMCP 3.4+](https://github.com/jlowin/fastmcp).

  **What's in the stack**
  - Scaffold command (`dude init --stack fastmcp`) that generates a modular
    FastMCP monolith: main server in `fastmcp/app/`, feature sub-servers mounted
    via `fastmcp.mount()`, Pydantic schemas, shared utilities, and a full pytest
    suite.
  - Docker Compose setup: `fastmcp` service (HTTP transport) + optional
    MCP Inspector UI behind the `dev` Docker Compose profile.
  - Commands: `up`, `down`, `logs`, `shell`, `lint`, `format`, `review`, `test`,
    `docs`, `security`.
  - 17 deterministic lint rules (MCP001–MCP017) covering: required project
    structure, feature package shape, sub-server contract, component placement,
    one-component-per-module, docstrings, type annotations, thin binding layer,
    Context convention, resource URI↔param parity, Pydantic schema conventions,
    snake_case naming, name/URI uniqueness, environment access isolation, no
    `print()` in production, error handling (ToolError only), and 1-to-1 test
    parity.
  - Matching `.claude/rules/MCP/NNN.md` prose files in the generated project so
    Claude Code understands every rule and can guide developers to fix violations.
  - MkDocs Material docs site with a `connect.md` page covering Inspector,
    Claude Desktop (stdio), and Claude Code integration.

  **Core fix (dude CLI)**

  `template-runner.ts`: the `_x` → `.x` dotfile rename rule now skips any file
  whose target name ends in `.py`, so Python private modules like `_server.py`
  survive scaffolding intact. Dotfiles never end in `.py`, so this is safe for
  all existing stacks.

## 0.11.0

### Minor Changes

- 2a23f16: Harden the AWS EKS IaC target end-to-end and add a live, auto-generated command reference.

  **@cubocicloide/dude**
  - `dude help --format md` / `--format json` (also `--md` / `--json`) emit the full,
    init-aware command catalog (core + active stack + project-local `.dude/commands/`)
    as Markdown or JSON — useful for docs and LLM/tooling consumption.
  - New public API `generateApiDoc(cwd, format)` so stacks can render that catalog
    (e.g. to regenerate a docs page) without shelling out.

  **@cubocicloide/stack-react-fastapi**
  - `dude docs` now regenerates `docs/api.md` from the live command catalog before
    serving, so the documented API always matches the project's actual commands
    (gitignored; also printable via `dude help --format md`).
  - IaC: ECR repositories are now **shared across environments** and owned by the
    `bootstrap` config (one image, promoted by tag), instead of being recreated per
    env — this avoids `RepositoryAlreadyExistsException` and stops one env's destroy
    from deleting another's registry. Repo URLs are derived from the account id
    (`aws_caller_identity`), so plan/apply/destroy no longer depend on the ECR API.
  - IaC: `dude iac destroy` now removes the Route53 records external-dns created for
    the env, guards the shared backend (S3 + DynamoDB + ECR) so it is torn down only
    with the **last** environment, and auto-retries after clearing leftover
    Kubernetes networking (load-balancer security groups and dangling CNI ENIs) that
    otherwise block VPC/subnet deletion with `DependencyViolation`.
  - IaC: `dude iac init` now passes `-reconfigure`, so switching `--env` against the
    shared Terraform working directory no longer fails with "Backend configuration
    changed".
  - IaC fixes: pin the RDS endpoint alongside DynamoDB/S3 (avoids a local DNS lookup
    failure during bootstrap/apply); `db_engine_version` defaults to `"17"`.
  - Docs: the generated project's docs now include a conditional IaC command section,
    a new "Command reference" page, and an expanded deploy guide (adding environments,
    multi-env teardown).

## 0.10.0

### Minor Changes

- bd506ab: Add an AWS EKS Infrastructure-as-Code target (Terraform + Helm) and conditional command visibility.

  **@cubocicloide/dude**
  - `StackCommandDef` gains an optional `available(projectRoot)` predicate. When it
    returns `false`, `dude help` hides that command (and empty groups are dropped).
    This lets a stack expose feature-gated commands that only appear when the
    matching init answer was chosen.
  - `dude help` now also hides the PostgreSQL-only `db` group on projects scaffolded
    without a database.

  **@cubocicloide/stack-react-fastapi**
  - New `iac` init option (`none` | `aws-eks`). Choosing `aws-eks` scaffolds an
    `iac/` directory with Terraform (VPC, EKS, ECR, AWS Load Balancer Controller,
    and managed RDS PostgreSQL when `--database postgres`) and a Helm chart for the
    application (backend, frontend, in-cluster Redis + Celery worker/beat/Flower
    when enabled, ALB Ingress, migration hook). The generated assets reflect the
    other answers (`postgres`/`celery`/`celerybeat`).
  - Terraform uses an S3 + DynamoDB remote backend configured per-environment, so
    the same flow works locally and in CI/CD. Environments scale by copying a
    folder (`environments/dev` ships by default); a `bootstrap/` config creates the
    state bucket + lock table once.
  - New `dude iac` command group — `init`, `plan`, `apply`, `destroy`, `output`,
    `fmt`, `validate`, `kubeconfig`, `deploy`, `status` — all `--env`-scoped. The
    group is shown **only** in IaC-enabled projects.
  - Production Dockerfiles (`backend/Dockerfile.prod`, `frontend/Dockerfile.prod`
    - `nginx.conf`) are added for building the images deployed to EKS.

## 0.9.0

### Minor Changes

- 2633e97: Add project-local custom commands under `.dude/commands/`.

  Any scaffolded project can now define its own `dude` commands by dropping a file
  in `.dude/commands/` — one file per command, named after the file (`reset.ts` →
  `dude reset`). No registration step.

  **@cubocicloide/dude**
  - New `defineCommand` helper exported from the package for authoring custom
    commands with full type-checking.
  - Custom commands are loaded with [jiti](https://github.com/unjs/jiti), so they
    can be written in TypeScript and `import` any package installed in the project
    (imports resolve against the project's own `node_modules`). `.mjs`/`.js` work too.
  - Dispatch precedence is **custom > stack > core**: a `.dude/commands/up.ts`
    overrides the stack's `up`. The dispatch hot path lazily loads only the invoked
    command, so unrelated command modules are never imported.
  - The core commands `init`, `upgrade`, `version`, and `help` are reserved and
    cannot be overridden.
  - `dude help` shows custom commands under a **PROJECT COMMANDS** section and
    marks overrides; load/validation failures surface as warnings.

  **@cubocicloide/stack-react-fastapi**
  - Scaffold ships a `.dude/commands/` directory with a `hello` example command
    and a `README.md` documenting the full contract.
  - PostgreSQL projects additionally get `dude reset` (drop DB → restart services →
    migrate → seed demo data) as a ready-to-use custom command under `.dude/commands/`.

## 0.8.0

### Minor Changes

- 7c1bb4d: Add global launcher, lockfile-backed version pinning, and OpenAPI pre-generation at init.

  **@cubocicloide/dude-launcher** (new package)
  Global shim installed once per machine (`npm i -g @cubocicloide/dude-launcher`). Walks up to the nearest `dude.json`, ensures the project's pinned CLI + stack are installed via the project's package manager, then re-execs `node_modules/.bin/dude`. Works from any subdirectory; `DUDE_SKIP_PROVISION` escape hatch for CI.

  **@cubocicloide/dude**
  - CLI and stack are now both pinned as exact `devDependencies` in the scaffolded `package.json` (lockfile-enforced); the `~/.dude` cache is a fallback only for `dude init` on bare machines.
  - `dude upgrade --stack` now updates `package.json` and `dude.json` in lockstep.
  - `minDudeVersion` declared by each stack is now enforced at runtime before any stack command runs.
  - New `satisfiesMinVersion` semver utility.
  - `StackContext` gains `stackVersion` so Handlebars templates can reference `{{stackVersion}}`.

  **@cubocicloide/stack-react-fastapi**
  - `dude init` pre-generates the full typed OpenAPI client from the bundled `openapi.yaml` template, making `dude api sync` a no-op until backend routes actually change.
  - `dude format` and `dude review` now invoke prettier/ESLint via `node_modules/.bin/` directly, avoiding pnpm workspace detection issues when the project root carries `@cubocicloide/...` devDependencies.
  - `scaffold()` passes `stackVersion` to Handlebars data so `package.json.hbs` can pin the correct stack version.

## 0.7.0

### Minor Changes

- afdb915: Add `dude upgrade` to update pinned CLI and stack versions in existing projects, and document the upgrade and rollback workflow in the stack and project docs.

## 0.6.1

### Patch Changes

- a1c9b91: Update README and template docs with first-run guide, full service URL table (Swagger UI, ReDoc, Flower), and hot reload instructions

## 0.6.0

### Minor Changes

- 77a06b3: Add YAML frontmatter to .claude agents and skills; migrate rules from applyTo to paths key
- cdff3ea: feat: export `renderTemplateTree` and `RenderOptions` for use in stack scaffold functions
- 77a06b3: Add non-interactive `make changeset-add` target and update release skill docs

## 0.5.0

### Minor Changes

- c86b0d0: feat: resolve stack version from npm registry at runtime — `registry.json` no longer pins a `stable` version; `dude init` queries npm for `latest`, installs that exact version, and pins it in `dude.json`/`package.json`

## 0.4.0

### Minor Changes

- 3d0a4d1: feat: auto-install stack on demand — when a stack package is not installed locally, dude installs it into `~/.dude/cache/stacks/` using npm and the user's `~/.npmrc` auth; cached by name+version so subsequent runs are instant

## 0.3.0

### Minor Changes

- 7305179: feat: generated project includes pinned package.json + .npmrc — `dude init` now writes a root `package.json` with `@cubocicloide/dude` pinned to the exact version used at init time, and a `.npmrc` ready for GitHub Packages auth

## 0.2.0

### Minor Changes

- b786a3d: feat: add `dude version` command, simplify init to single `dude.json`, add hooks/utils/assets to frontend template, add FE008 lint check, simplify Docker dev setup with HMR volumes
