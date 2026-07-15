# @cubocicloide/dude

## 0.13.0

### Minor Changes

- 628eb2b: Two-phase release channels: every publish now lands on the `next` dist-tag (candidate channel); `latest` (stable) only moves via explicit promotion (`make promote`). `dude init` and `dude upgrade` resolve the stable channel by default and accept `--next` to opt into the newest published candidate; the launcher honors `DUDE_CHANNEL=next` when delegating project-less commands to the published CLI.

## 0.12.0

### Minor Changes

- 397fef5: Project-defined lint rules, uniform across every stack.
  - `dude lint` now also runs project checks from `.dude/lint/checks/<GROUP>/<id>.ts`
    (loaded via jiti — real TypeScript, project imports allowed), under the same
    `CheckFn` contract stack checks use; the rule code is derived from the path.
  - A code defined twice (stack + project, or twice in the project) is a hard
    error; stack rules can be disabled per-project via `dude.json` →
    `lint.disable: ["BE003", …]` (unknown codes produce a notice).
  - New `defineLintCommand()` export in `@cubocicloide/dude`; all stacks now
    register their `lint` command through it instead of hand-rolled wrappers
    (the stacks' peer range on `@cubocicloide/dude` moves to `^0.12.0`
    accordingly — upgrade both pins together with `dude upgrade`).
  - Scaffolds ship a `.dude/lint/checks/` README + `PRJ/001.ts` starter example,
    and the generated docs describe project lint rules.

## 0.11.7

### Patch Changes

- 045d31f: New stack: **frappe** — a Frappe Framework + Frappe Helpdesk ticketing system
  that doubles as a worked example of Frappe's core building blocks.
  - **Scaffold** — dockerised dev bench (MariaDB, redis-cache/redis-queue,
    `frappe/bench` container self-provisioned by `docker/init.sh`), the site,
    optional Frappe Helpdesk install, and a custom app `apps/ticketing`
    demonstrating DocTypes (model + controller + form script + tests),
    whitelisted API methods, scheduled tasks, doc_events on `HD Ticket`,
    an approval Workflow shipped as fixtures, and a portal page.
  - **Commands** — `up/down/logs/shell`, `bench` (raw passthrough),
    `site migrate/console/backup/clear-cache/mariadb`, `app new/install`,
    `test`, `format` (ruff, Frappe style), `review`, `docs`, `lint`.
  - **Lint rules** — 11 Frappe best-practice checks (APP001–004 app layout and
    hooks integrity, DT001–004 DocType conventions, PY001–003 Python safety),
    each mirrored by a prose rule in the generated project's `.claude/rules/`.
  - **IaC** — `--iac aws-ecs`: Terraform for AWS ECS Fargate (ALB, RDS MariaDB,
    ElastiCache Redis, EFS sites volume; frontend/backend/websocket/worker/
    scheduler services from a single frappe_docker-style image) plus the full
    `dude iac …` command group including `create-site` and `migrate`.

  `@cubocicloide/dude`: register the `frappe` stack in `registry.json`.

## 0.11.6

### Patch Changes

- be9764c: fix(windows): make dude process execution reliable on win32

  Windows needs `shell: true` for `spawnSync`/`execFileSync` to resolve
  package-manager shims (`.cmd`/`.bat` — pnpm, npm, npx, uv) that aren't real
  executables; without it, spawning them throws `ENOENT` even though the tool
  is on PATH. Every stack command that shells out to a tool other than
  `docker` (a real executable, unaffected) now opts into shell execution on
  `win32` only, and reports `result.error` instead of silently treating a
  failed spawn as a plain non-zero exit. `docs`'s browser launcher now uses
  `cmd /c start` on Windows (bare `start` is a cmd.exe builtin, not a program).

  Covers `dude-launcher` (pnpm/npx install), the CLI core (`dude upgrade`,
  stack resolution/install), and the fastmcp, react-django, react-fastapi,
  tauri and airflow stacks (docs, format, review, test, iac shared exec).

## 0.11.5

### Patch Changes

- 952299e: feat: add airflow stack (Apache Airflow 3)

  New stack plugin `@cubocicloide/stack-airflow`:
  - Airflow 3 in Docker Compose (api-server, scheduler, dag-processor,
    triggerer) — one image, user packages via pinned `requirements.txt`
  - Sign-on choice at init (`--sso native|entra-id`): Airflow user DB or
    Microsoft Entra ID OAuth via the FAB auth manager (app-role → Airflow-role
    mapping)
  - Organized DAG/plugin layout enforced by lint rules AF001–AF010 (dag_id ↔
    filename parity, explicit schedule/catchup/tags, shared `lib.defaults`,
    parse-time hygiene, plugin registration, pinned requirements, env-var
    parity with `.env.example`)
  - Example DAGs: TaskFlow ETL, dedicated-container runs via
    `EcsRunTaskOperator` and `KubernetesPodOperator`, and a simulated AWS Batch
    compute-intensive pattern (dynamic task mapping fan-out/reduce, real
    `BatchOperator` array-job path included)
  - Reference plugin `ops_toolkit`: DAG-run listeners, Jinja macros, custom
    `WorkdayTimetable`
  - `dude dag list|errors|trigger|test`, `dude test` (DAG integrity suite in
    the image), `dude format` (uvx ruff)
  - Optional IaC (`--iac aws-ecs`): Terraform for AWS ECS Fargate — ALB +
    api-server, core service, RDS Postgres, S3 remote task logs, Secrets
    Manager (`dude iac secrets`), one-off `dude iac migrate`, and the AWS ECS
    executor (every Airflow task in its own dedicated Fargate container)

  The CLI's `registry.json` now maps the `airflow` stack name to the new
  package.

## 0.11.4

### Patch Changes

- bdf75a2: feat: new `react-django` stack — React (Vite + TS) frontend with a Django 5 + DRF backend.
  - Backend template: custom User model, split settings (base/local/production via
    django-environ), services layer for writes, drf-spectacular (`/api/schema/`,
    Swagger UI at `/api/docs/`), pytest + pytest-django, uv-managed.
  - Init questions mirror react-fastapi plus a new `storage` select (`none` | `s3`);
    choosing `s3` adds a `files` Django app (uploads via django-storages/boto3,
    presigned URLs) and a MinIO service (+ bucket bootstrap) in docker-compose.
  - 14 Django lint checks (BE001–BE014, 9 errors / 5 warnings) enforcing app
    registration parity, explicit serializer fields/permissions, no raw SQL, no ORM
    writes in views, committed migrations, settings hygiene, URL namespacing,
    model quality, related_name, logging over print, typed OpenAPI schema and
    per-app tests — each with a matching `.claude/rules/BE/*.md`.
  - Full command set: up/down/logs/shell, lint, format, review, test, docs,
    security (bandit/semgrep(+p/django)/trivy), api sync/review (drf-spectacular),
    db makemigration/migrate/rollback/superuser.
  - IaC target `--iac aws-ecs`: Terraform for ECS Fargate — ALB path routing
    (backend/frontend), two ECR repos, RDS PostgreSQL with Secrets Manager
    credentials, optional S3 media bucket / ElastiCache Redis / Celery worker+beat
    services, one-off migration task driven by the new `dude iac migrate` command.
  - CLI: register the `react-django` stack in `registry.json`.

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
