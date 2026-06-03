# @cubocicloide/stack-react-fastapi

React (Vite + TypeScript) frontend with a FastAPI backend, scaffolded by [`dude`](../../packages/dude).

## Usage

```bash
dude init my-app --stack react-fastapi
```

## Variables

| Name          | Type    | Default  | Description               |
| ------------- | ------- | -------- | ------------------------- |
| `projectName` | string  | `my-app` | Project slug (kebab-case) |
| `database`    | string  | —        | `postgres` to enable PostgreSQL + Alembic migrations |
| `celery`      | boolean | `false`  | Add Celery worker + Redis |
| `celeryBeat`  | boolean | `false`  | Add Celery Beat scheduler (implies `celery`) |

## Layout produced

```
<projectName>/
├── README.md
├── .gitignore
├── frontend/           # Vite + React + TypeScript
│   └── src/
│       └── openapi/    # Auto-generated typed API client — do not edit by hand
├── backend/            # FastAPI (Python ≥ 3.13, uv)
│   └── app/
│       ├── core/       # settings, database session, shared utilities
│       ├── models/     # SQLAlchemy ORM models
│       ├── queries/    # database query functions
│       ├── routers/    # APIRouter modules
│       ├── schemas/    # Pydantic schemas
│       ├── tasks/      # Celery task definitions
│       ├── tests/      # pytest suite (models / queries / routers / tasks / utils)
│       └── utils/      # pure helper functions
├── docs/               # MkDocs documentation site
├── e2e/                # Playwright + Cucumber end-to-end tests
└── docker-compose.yml
```

## Lint checks

`dude lint` enforces naming, layout, and test-coverage conventions defined in
`src/commands/lint/checks/`. Each check has a companion explanation in
`template/.claude/rules/`.

| Check | What it enforces |
|-------|-----------------|
| BE001 | Required directories exist in `backend/app/` |
| BE002–BE011 | Naming, import, config, and test-coverage rules |
| FE001–… | Frontend naming and structure rules |
| E2E001–… | E2e feature/step naming rules |
