# @cubocicloide/stack-react-fastapi

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
