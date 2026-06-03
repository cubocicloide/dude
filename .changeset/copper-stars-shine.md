---
"@cubocicloide/stack-react-fastapi": minor
---

feat: optional PostgreSQL (SQLModel + Alembic), Celery worker and Celery Beat support

`dude init` now asks three extra questions:
- **Database** — `none` (default) or `postgres`
- **Add Celery worker?** — boolean
- **Add Celery Beat?** — boolean (auto-enables Celery)

Selecting postgres scaffolds: `alembic.ini`, `alembic/env.py`, `start.sh` (waits for Postgres, runs migrations), `app/core/database.py`, `User` model + `UserQueries` class + `GET /api/users/` router, and conditional `docker-compose.yml` services (`postgres` with healthcheck, `alembic` volume mounts).

Selecting Celery adds: `app/worker.py`, `app/tasks/example.py`, Flower monitor in compose.

Selecting Celery Beat adds: `app/tasks/scheduled.py` with a periodic `heartbeat` task.

New `dude db` commands: `makemigration`, `migrate`, `rollback` — run Alembic inside the backend container.
