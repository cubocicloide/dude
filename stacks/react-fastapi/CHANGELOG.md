# @cubocicloide/stack-react-fastapi

## 10.1.2

### Patch Changes

- e465421: fix(iac): destroy the shared backend + ECR when the last env is torn down

  `dude iac destroy` decided whether to tear down the shared bootstrap (S3 state
  bucket + DynamoDB lock + ECR repos) by listing the environment _folders_ on
  disk. But a folder (`backend.hcl` + `terraform.tfvars`) survives a
  `terraform destroy`, so after destroying `staging` then `dev`, the guard still
  saw the leftover `staging/` folder and concluded the backend was "still in use"
  — refusing to ever tear it down. The shared S3 bucket, DynamoDB table and ECR
  repositories were orphaned even though no live infrastructure remained.

  Liveness is now read from each sibling environment's **remote Terraform state**
  (empty `resources` after a destroy) instead of the on-disk folder, so the last
  environment's teardown correctly removes the shared backend + ECR. The decision
  is logged per sibling, and an unreadable-but-present state is treated as live so
  a transient read error never wipes another env's backend.

## 10.1.1

### Patch Changes

- a58348d: fix(iac): pin the cluster context for `status`/`deploy`/`destroy`, not just `shell`

  The containerized `kubectl`/`helm` calls behind `dude iac status`, `deploy` and
  `destroy` inherited the host's kubectl _current-context_. In the normal flow
  (you just ran `dude iac kubeconfig --env <env>`) that's the right cluster, but if
  your current-context was left on another project/env, those commands silently
  acted on the wrong cluster.

  `run`/`capture` now take an optional `kube` target ({cluster, region, namespace}).
  When routing a kube tool through the runner, the invocation is wrapped in a
  prelude that builds a dedicated in-container kubeconfig for that exact cluster
  (`aws eks update-kubeconfig`) and selects the namespace — so `status`/`deploy`/
  `destroy` always target the env named by `--env`. The prelude is silent on
  stdout (so captured output stays clean) and, if the cluster is unreachable,
  falls back to the mounted `~/.kube` with a stderr warning rather than guessing.

  The cluster name follows the scaffold convention (`<project>-<env>`); the region
  comes from the env's tfvars. The native fallback path (`DUDE_IAC_RUNNER=host` or
  no Docker) is unchanged — it still uses the host kubeconfig as-is.

- 457d069: fix(iac): `dude iac shell` pins the kube context + namespace to the target env

  `dude iac shell --env <env>` mounted the host `~/.kube` read-only and dropped you
  into a shell on whatever your host's _current-context_ happened to be — which
  might be a different cluster (e.g. another project, or `prod` while you asked for
  `dev`). It also opened on the `default` namespace, so `k9s`/`kubectl get pods`
  looked empty even when the app was running in the env's namespace.

  The shell now builds a dedicated in-container kubeconfig for the env's own
  cluster (`aws eks update-kubeconfig` against the mounted credentials) and selects
  the env's namespace, so `kubectl`/`helm`/`k9s` target the right cluster + see the
  right pods immediately. If the cluster can't be reached (not provisioned yet,
  bad creds) it falls back to the mounted `~/.kube` with a warning rather than
  silently acting on the wrong cluster.

## 10.1.0

### Minor Changes

- f0f4be4: feat(iac): run the IaC toolchain in a Docker runner + add `dude iac shell`

  `dude iac *` shelled out to terraform/kubectl/helm/k9s on the host, forcing the
  customer to install and version-match all of them — a portability and
  reproducibility problem across operating systems.

  These tools now run inside a pinned container built from the scaffold's own
  `iac/runner/Dockerfile` (customer-owned and editable; the image is tagged by a
  hash of that file, so any edit rebuilds automatically). Routing is transparent:
  a provider-local `exec.ts` wraps the generic `run`/`capture` and rewrites
  containerized-tool invocations into `docker run …`, mounting the working
  directory at `/work` so the relative paths the commands already use resolve
  unchanged. Credentials are never baked in — `~/.aws` (profiles + SSO cache) and
  `~/.kube` are mounted in and `AWS_PROFILE` is passed through, so named profiles
  and SSO keep working exactly as before.

  `aws` and `docker build/push` stay on the host (the host needs `aws` for the SSO
  browser in `dude iac login` anyway, and image builds need the host daemon).
  Everything else — terraform/kubectl/helm — runs in the container. Set
  `DUDE_IAC_RUNNER=host` to use native tools instead; `dude iac` also falls back to
  native automatically when Docker isn't running.

  New command **`dude iac shell --env <env>`** opens an interactive shell in the
  runner with the full toolchain + k9s, the env's AWS profile and the cluster
  kubeconfig already wired — for ad-hoc inspection or changes.

## 10.0.1

### Patch Changes

- c85d96b: fix(iac): `dude iac new-env` now also copies the per-env Helm values file

  `new-env` only copied the Terraform environment folder
  (`iac/terraform/environments/<name>`), leaving the new env without a
  `helm/app/values-<env>.yaml`. Since that file is gitignored and optional at
  deploy time, the new environment would silently deploy with the bare
  `values.yaml` defaults instead of the source env's overrides (replicas,
  autoscaling, config, secrets) — a quiet footgun, despite the command's "copy an
  existing one" contract.

  `new-env` now copies `values-<from>.yaml` → `values-<env>.yaml` when the source
  file exists on disk, and the success message + docs reflect it. No change when
  the source env has no values file (deploy still falls back to `values.yaml`).

## 10.0.0

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

### Patch Changes

- 1ac9cd3: Fix the getting-started documentation in generated projects.
  - Correct the global install: it's `@cubocicloide/dude-launcher` (not `@cubocicloide/dude`).
  - Document the private GitHub Packages registry auth (`~/.npmrc` + `GITHUB_TOKEN`).
  - Add the correct lifecycle order: launcher → `dude init` → `pnpm install` → `dude up --build`.
  - Note for users who cloned an existing project to skip `dude init` and start at `pnpm install`.
  - Add a documentation-site section (`dude docs`) to the README.
  - `docs/index.md` now has a full Getting started block and links to `api.md` / `deploy.md`.

- Updated dependencies [2a23f16]
  - @cubocicloide/dude@0.11.0

## 9.0.0

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

### Patch Changes

- Updated dependencies [bd506ab]
  - @cubocicloide/dude@0.10.0

## 8.1.0

### Minor Changes

- 6af687a: Add guided scaffolding skills to the generated `.claude/skills/`.

  Scaffolded projects now ship three Claude skills that scaffold new code while
  enforcing the stack's structural rules and reusing existing code:
  - `/create` — router skill: asks whether you want a backend route or a frontend
    page, then runs the matching flow.
  - `/create-route` — asks for the path, method(s) and response shape, surveys
    existing schemas/queries/routers for reuse, creates the router and registers
    it in `main.py`, adds any model/query/schema, writes the 1-to-1 tests, and
    regenerates the typed frontend client. Enforces the `BE` rules.
  - `/create-page` — asks for the route path and what to display, surveys the
    shared component library, hooks and generated API client for reuse, creates
    the page directory, wires the route into `App.tsx`, and adds any new
    components/hooks. Enforces the `FE` rules.

## 8.0.0

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

### Patch Changes

- Updated dependencies [2633e97]
  - @cubocicloide/dude@0.9.0

## 7.0.0

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

### Patch Changes

- Updated dependencies [7c1bb4d]
  - @cubocicloide/dude@0.8.0

## 6.0.2

### Patch Changes

- 3dc82b2: Fix the docs landing page quick links and refresh the tech stack summary in the generated project documentation.

## 6.0.1

### Patch Changes

- 22fd223: `dude format`: reinstall frontend or e2e dependencies when `node_modules` exists but the required `prettier` binary is missing

## 6.0.0

### Patch Changes

- afdb915: Add `dude upgrade` to update pinned CLI and stack versions in existing projects, and document the upgrade and rollback workflow in the stack and project docs.
- Updated dependencies [afdb915]
  - @cubocicloide/dude@0.7.0

## 5.0.6

### Patch Changes

- 0fd5a7f: `dude format`: auto-install frontend and e2e dependencies before running Prettier

## 5.0.5

### Patch Changes

- 3637c3b: `e2e`: default to `http://localhost:5173` and show a friendly error when the app is not reachable

## 5.0.4

### Patch Changes

- ec60d9b: `dude test`: run `playwright install` after `pnpm install` in e2e/

  After auto-installing e2e node_modules, the test command now also
  runs `pnpm exec playwright install` so Chromium/Firefox/WebKit
  browsers are available before cucumber-js tries to launch them.

## 5.0.3

### Patch Changes

- ed9d90a: `dude test`: auto-install e2e node_modules when missing

  Before running `pnpm run test` in `e2e/`, the test command now checks
  whether `node_modules/` exists and runs `pnpm install` automatically
  if it does not. This fixes the `cucumber-js: command not found` error
  on first run.

## 5.0.2

### Patch Changes

- c0f1659: Fix scaffolded backend test suite to pass out of the box
  - `conftest.py`: switch to `ASGITransport` (httpx ≥ 0.27 dropped `app=` kwarg), make `client` fixture async
  - Postgres overlay `conftest.py`: add `db` fixture (in-memory SQLite via `StaticPool`) and override `get_db` dependency so router tests never need a real Postgres connection
  - `test_user.py`: fix field reference `name` → `full_name` to match the actual `User` model
  - `user.py`: replace deprecated `datetime.utcnow` with `datetime.now(UTC)` (Python 3.13)
  - `config.py.hbs`: replace deprecated `class Config` with `model_config = SettingsConfigDict(...)` (Pydantic v2)
  - `pyproject.toml.hbs`: add `anyio[trio]` dev-dependency and `[tool.pytest.ini_options] asyncio_mode = "strict"`

## 5.0.1

### Patch Changes

- a1c9b91: Update README and template docs with first-run guide, full service URL table (Swagger UI, ReDoc, Flower), and hot reload instructions
- Updated dependencies [a1c9b91]
  - @cubocicloide/dude@0.6.1

## 5.0.0

### Minor Changes

- 77a06b3: Add YAML frontmatter to .claude agents and skills; migrate rules from applyTo to paths key
- cdff3ea: feat: optional PostgreSQL (SQLModel + Alembic), Celery worker and Celery Beat support

  `dude init` now asks three extra questions:
  - **Database** — `none` (default) or `postgres`
  - **Add Celery worker?** — boolean
  - **Add Celery Beat?** — boolean (auto-enables Celery)

  Selecting postgres scaffolds: `alembic.ini`, `alembic/env.py`, `start.sh` (waits for Postgres, runs migrations), `app/core/database.py`, `User` model + `UserQueries` class + `GET /api/users/` router, and conditional `docker-compose.yml` services (`postgres` with healthcheck, `alembic` volume mounts).

  Selecting Celery adds: `app/worker.py`, `app/tasks/example.py`, Flower monitor in compose.

  Selecting Celery Beat adds: `app/tasks/scheduled.py` with a periodic `heartbeat` task.

  New `dude db` commands: `makemigration`, `migrate`, `rollback` — run Alembic inside the backend container.

- 77a06b3: Add non-interactive `make changeset-add` target and update release skill docs

### Patch Changes

- Updated dependencies [77a06b3]
- Updated dependencies [cdff3ea]
- Updated dependencies [77a06b3]
  - @cubocicloide/dude@0.6.0

## Unreleased

### Minor Changes

- **tasks/ is now a required backend directory**: `backend/app/tasks/` and
  `backend/app/tests/tasks/` are part of the required structure enforced by
  lint checks BE001 and BE008.
- `template/backend/app/tasks/__init__.py` and
  `template/backend/app/tests/tasks/__init__.py` added to the base scaffold.
- Celery overlay now includes `tests/tasks/test_example.py`; CeleryBeat overlay
  includes `tests/tasks/test_scheduled.py`.
- `.claude/rules/BE/001.md` and `008.md` updated to reflect the new structure.

## 4.0.0

### Patch Changes

- Updated dependencies [c86b0d0]
  - @cubocicloide/dude@0.5.0

## 3.0.0

### Patch Changes

- Updated dependencies [3d0a4d1]
  - @cubocicloide/dude@0.4.0

## 2.0.0

### Minor Changes

- 7305179: feat: generated project includes pinned package.json + .npmrc — `dude init` now writes a root `package.json` with `@cubocicloide/dude` pinned to the exact version used at init time, and a `.npmrc` ready for GitHub Packages auth

### Patch Changes

- Updated dependencies [7305179]
  - @cubocicloide/dude@0.3.0

## 1.0.0

### Minor Changes

- b786a3d: feat: add `dude version` command, simplify init to single `dude.json`, add hooks/utils/assets to frontend template, add FE008 lint check, simplify Docker dev setup with HMR volumes

### Patch Changes

- Updated dependencies [b786a3d]
  - @cubocicloide/dude@0.2.0
