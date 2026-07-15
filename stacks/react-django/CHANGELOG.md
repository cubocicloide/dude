# @cubocicloide/stack-react-django

## 3.0.2

### Patch Changes

- 59902ae: Fix `dude init` failing with `Cannot find package '@cubocicloide/dude'` when a stack is resolved via the cache-install path (fresh machine, no existing workspace/project). `@cubocicloide/dude` is imported unbundled at runtime (`external` in tsup) but had only been declared in `devDependencies` since #78 removed the redundant `peerDependencies` entry — devDependencies are never installed for a package consumed as someone else's dependency, so nothing pulled `@cubocicloide/dude` into `~/.dude/cache/stacks/…/node_modules`. Moved it to a real `dependencies` entry (still `workspace:*`, rewritten to an exact version at publish) instead of `peerDependencies`, so it installs correctly without reintroducing the changesets peer-range major-bump bug.

## 3.0.1

### Patch Changes

- c93f206: Drop the redundant `peerDependencies` on `@cubocicloide/dude` from every stack. It duplicated the `devDependencies` pin and served no functional purpose (scaffolded projects pin `dude` directly; runtime compatibility is enforced by `minDudeVersion`). The `workspace:^` form also triggered a Changesets bug that forced a spurious **major** bump on every stack whenever `dude` was released; with the peer entry gone, a `dude` release no longer re-versions the stacks at all.

## 3.0.0

### Patch Changes

- Updated dependencies [628eb2b]
  - @cubocicloide/dude@0.13.0

## 2.0.0

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

## 1.0.0

### Major Changes

- 10dc874: Frontend structure overhaul: privileged `$`-directories, zustand, favicon, and 12 FE lint rules — the same refactor already shipped for `react-fastapi`, adapted for Django.

  **New frontend layout (breaking for scaffolded projects).** The frontend tree is now organised in scopes with privileged `$`-prefixed folders that sort on top and can never be confused with a route segment or domain name:
  - `components/` → `$components/`, `hooks/` → `$hooks/` (both nestable inside components and pages — matrioska).
  - Every scope (component, hook, page, utils domain) owns the same file set: `index.tsx`, `styles.module.css`, `types.tsx`, `constants.tsx`, `functions.tsx`, plus `$assets/` (non-code files only) and `$misc/` (check-exempt escape hatch, always warned).
  - `index.css` → `styles.module.css` (global selectors via `:global(...)`).
  - New `$types/` folder holds every `*.d.ts` (e.g. `vite-env.d.ts`).
  - `utils/` is now organised in kebab-case domains (e.g. `utils/formatters/`).
  - Page route segments must be kebab-case or a dynamic `[param]` (e.g. `pages/users/[id]/`).

  **Lint.** FE001–FE008 rewritten for the `$`-structure (FE002/FE005/FE006/FE009/FE010 report unexpected files/directories as errors); new FE009 (utils domains), FE010 (src root layout + `$types`), FE011 (`$misc` warning with relocation guidance), FE012 (`index.tsx` hygiene). All `.claude/rules/FE/*.md` updated in the template.

  **Zustand.** Added `zustand` to the scaffold dependencies with an example store (`$hooks/useCounterStore/`, devtools middleware enabled only in dev) and a demo card on the home page.

  **Users pages.** New `/users` and `/users/[id]` pages (antd Table + Descriptions over the generated OpenAPI client), wired into `App.tsx` and the Layout sidebar. Unlike `react-fastapi`, the users API is part of Django's always-present `auth` app, so the pages live in the **base** overlay (not postgres-gated) and consume DRF's **paginated** list response (`results`) and the Django `User` shape (`username`, `first_name`, `last_name`, `date_joined`).

  **Fixes carried over.** Frontend `tsconfig.json` now sets `noEmit: true` (avoids stray `.js` from `tsc -b`); ESLint disables `react-refresh/only-export-components` under `src/utils/`; added a default `frontend/public/favicon.svg`.

## 0.2.1

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

- Updated dependencies [be9764c]
  - @cubocicloide/dude@0.11.6

## 0.2.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [bdf75a2]
  - @cubocicloide/dude@0.11.4
