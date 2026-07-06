# @cubocicloide/stack-react-django

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
