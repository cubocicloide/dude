# @cubocicloide/stack-frappe

## 2.0.0

### Patch Changes

- Updated dependencies [628eb2b]
  - @cubocicloide/dude@0.13.0

## 1.0.0

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

### Patch Changes

- Updated dependencies [397fef5]
  - @cubocicloide/dude@0.12.0

## 0.2.3

### Patch Changes

- 45c327e: Fix two issues surfaced by a first `dude iac create-site` run.
  - The `configurator` ECS task ran `bench set-config -g db_host ...` before `common_site_config.json` existed on a fresh EFS `sites/` volume, crashing with `FileNotFoundError` on the very first deploy. It now seeds an empty `{}` config file first.
  - `dude iac logs` shells out to `aws logs tail`, which is an AWS CLI **v2** subcommand — on a v1 CLI it fails with a confusing raw argparse "invalid choice" error. Detect a v1 CLI up front and fail with an actionable message (upgrade link + a `filter-log-events` fallback) instead.

- 45c327e: Fix `dude lint` false positives on `__pycache__` and add customizable branding to the `ticketing` example app.
  - DT001–DT004 and PY003 no longer treat a `doctype/__pycache__/` directory (created by running the bench) as a DocType bundle — `listDoctypeDirs()` now excludes `__pycache__` and dotfiles when listing doctype directory names.
  - Add `ticketing/public/images/logo.png` and `favicon.png` placeholder assets, wired via `app_logo_url` / `website_context.favicon` in `hooks.py` (Desk + portal) and a new `set_default_branding` patch that points Helpdesk's own `HD Settings.brand_logo` / `favicon` at the same files. Rebranding is a file swap — no code or database change needed.
  - `docker/init.sh` now runs `bench build --app <app>` for symlinked custom apps (previously only apps fetched via `bench get-app` got their assets built, so a custom app's own static assets — e.g. the new branding images — would 404).

- 45c327e: Fix `terraform apply` failure on the ECS IaC: the `aws_security_group.app` self-ingress rule description used a `->` arrow, and AWS rejects `>` in security group rule descriptions (`"ingress.0.description" doesn't comply with restrictions`). Reworded to "frontend to backend/websocket (service discovery)".

## 0.2.2

### Patch Changes

- 78d01df: Fix `dude lint` false positives on `__pycache__` and add customizable branding to the `ticketing` example app.
  - DT001–DT004 and PY003 no longer treat a `doctype/__pycache__/` directory (created by running the bench) as a DocType bundle — `listDoctypeDirs()` now excludes `__pycache__` and dotfiles when listing doctype directory names.
  - Add `ticketing/public/images/logo.png` and `favicon.png` placeholder assets, wired via `app_logo_url` / `website_context.favicon` in `hooks.py` (Desk + portal) and a new `set_default_branding` patch that points Helpdesk's own `HD Settings.brand_logo` / `favicon` at the same files. Rebranding is a file swap — no code or database change needed.
  - `docker/init.sh` now runs `bench build --app <app>` for symlinked custom apps (previously only apps fetched via `bench get-app` got their assets built, so a custom app's own static assets — e.g. the new branding images — would 404).

## 0.2.1

### Patch Changes

- 30df9fa: Fix Frappe Helpdesk telephony dependency and `apps.txt` append corruption.
  - Fetch `telephony` before `helpdesk` in both `docker/init.sh` and `docker/Dockerfile.prod.hbs` — Helpdesk declares `required_apps = ["telephony"]` but Frappe does not auto-fetch it, causing a bare `ModuleNotFoundError` on install.
  - Add `append_app_txt()` helper in `docker/init.sh` that ensures a trailing newline before appending to `sites/apps.txt`, preventing entries from being concatenated onto the same line (e.g. `telephonyticketing`).

## 0.2.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [045d31f]
  - @cubocicloide/dude@0.11.7
