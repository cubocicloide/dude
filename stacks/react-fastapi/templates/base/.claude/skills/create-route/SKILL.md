---
name: create-route
description: Scaffold a new backend API route (FastAPI). Asks for the path, HTTP method(s) and response shape, surveys existing schemas/queries/routers for reuse, then creates the router file, registers it in main.py, adds any model/query/schema, writes the 1-to-1 tests, and regenerates the typed frontend client — all enforcing the backend BE rules.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *)"
---

# Create Route

Guided creation of a backend API endpoint that satisfies every backend rule in
`.claude/rules/BE/`. The skill **inspects the existing codebase first** so new
code reuses existing schemas, query classes and router patterns instead of
duplicating them.

> Read `.claude/rules/BE/001.md`–`011.md` once at the start — they are the
> source of truth. The summary below tracks them but the rule files win.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

Detect whether a database layer exists (needed for model/query work):

```bash
test -f "$PROJECT_ROOT/backend/app/core/database.py" && echo "db: yes" || echo "db: no"
```

If `db: no` and the route needs persistence, tell the user this is a
non-postgres project — the route can still be created but without model/query
files (or they should re-scaffold with `--database postgres`).

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **HTTP path** — e.g. `/todos`, `/todos/{id}`, `/users/me`.
2. **Method(s)** — `GET` / `POST` / `PUT` / `PATCH` / `DELETE` (one route file may
   hold several methods that share the same path prefix).
3. **Response shape** — a single resource, a list, or a plain dict.
4. **Request body** (for POST/PUT/PATCH) — which fields.
5. **Persistence?** — does it read/write the database, or is it stateless?

---

## Step 2 — Survey the existing code (reuse before create)

Run these and **read the relevant matches** before proposing anything:

```bash
ls "$PROJECT_ROOT"/backend/app/routers/*.py
ls "$PROJECT_ROOT"/backend/app/schemas/*.py 2>/dev/null
ls "$PROJECT_ROOT"/backend/app/models/*.py 2>/dev/null
ls "$PROJECT_ROOT"/backend/app/queries/*.py 2>/dev/null
```

- **Similar router** — find the closest existing router (same resource family or
  same method) and mirror its structure, imports and style.
- **Existing schema** — if a schema already models this resource
  (`schemas/<resource>.py`), reuse it. Only create a new one if none fits (BE003).
- **Existing model / query** — if the resource already has a model and a query
  class, reuse them; add a new query method rather than a new class when the
  operation fits an existing class (BE011).

Report what you found and what you intend to reuse.

---

## Step 3 — Derive the router filename (BE006)

The filename **determines** the URL prefix — never hard-code the prefix in the
route decorator (BE007).

| Path | Router file | Decorator path |
|------|-------------|----------------|
| `/todos` | `routers/todos.py` | `@router.get("")` / `@router.post("")` |
| `/todos/{id}` | `routers/todos__id.py` | `@router.get("/{id}")` |
| `/users/me` | `routers/users_me.py` | `@router.get("/me")` |
| `/keycloak/token` | `routers/keycloak_token.py` | `@router.post("/token")` |

Rules: lowercase alphanumeric segments; `_` joins a literal sub-segment; `__`
introduces a path parameter (`__id` → `/{id}`).

---

## Step 4 — Plan the file set (confirm before writing)

Present the full list of files to **create** and **modify**, then wait for an OK.
A typical persistent route touches:

| File | Rule | Purpose |
|------|------|---------|
| `routers/<file>.py` | BE004, BE007 | the route(s); module-level `router = APIRouter(...)`, only `@router.METHOD` async/def handlers |
| `app/main.py` | BE005 | `from app.routers import <file>` + `api_router.include_router(<file>.router)` |
| `models/<resource>.py` | BE002, BE010 | one SQLModel class, PascalCase of filename — only if a new entity is introduced |
| `queries/<resource>.py` | BE011 | query class(es) named with the PascalCase prefix — only for DB access |
| `schemas/<resource>.py` | BE003 | request/response Pydantic/SQLModel schemas — only if no existing schema fits |
| `tests/routers/test_<file>.py` | BE008 | 1-to-1 test for the router |
| `tests/models/test_<resource>.py` | BE008 | 1-to-1 test for a new model |
| `tests/queries/test_<resource>.py` | BE008 | 1-to-1 test for a new query |
| `core/config.py` | BE009 | any new env var, added to `Settings` in **alphabetical** order |

Skip rows that don't apply. Every new source file under `models/ queries/
routers/ tasks/ utils/` **must** get its matching test in the same change (BE008).

---

## Step 5 — Implement

Follow the existing patterns exactly. Reference shapes:

```python
# routers/todos__id.py  →  prefix /todos/{id}  (BE004/006/007)
"""Todos by ID router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_db
from app.models.todo import Todo
from app.queries.todos import TodosQueries

router = APIRouter(tags=["todos"])
_todos = TodosQueries()


@router.get("/{id}", response_model=Todo)
def get_todos__id(id: int, db: Session = Depends(get_db)) -> Todo:
    """Return a single todo by ID."""
    todo = _todos.get_by_id(db, id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo
```

```python
# main.py registration (BE005) — alphabetical import block, one include per file
from app.routers import (
    health,
    todos,
    todos__id,
)
...
api_router.include_router(todos.router)
api_router.include_router(todos__id.router)
```

Constraints to honour while writing:
- Router files contain **only** `@router.*` handlers — helpers go in `utils/` (BE007).
- The router variable is named exactly `router` (BE004).
- No `os.getenv`/`os.environ` outside `core/config.py` (BE009).
- One class per model file, named after the file (BE010/BE002).
- Schemas extend `BaseModel`/`SQLModel`, prefixed with the PascalCase resource
  name (`TodoCreate`, `TodoRead`, …); enums/mixins go in `utils/` (BE003).
- Write meaningful tests (don't just assert 200) mirroring
  `tests/routers/test_health.py` / `test_users.py` style.

---

## Step 6 — Validate

```bash
cd "$PROJECT_ROOT"
dude lint                 # must pass — fixes any BE rule violations
dude api sync             # regenerate frontend/src/openapi/ from the new route
dude test --backend       # if available — run the new tests
```

If `dude lint` reports a violation, fix it and re-run before continuing. After
`dude api sync` the new endpoint is available to the frontend as
`@/openapi/api/<resource>` (`$get`, `$post`, …).

---

## Step 7 — Report

```
Route created
═════════════════════════════════════════
Path        <METHOD> /api<path>
Router      backend/app/routers/<file>.py
Registered  main.py (api_router.include_router)
Model       <created | reused | n/a>
Query       <created | reused | n/a>
Schema      <created | reused | n/a>
Tests       tests/routers/test_<file>.py (+ model/query tests)
─────────────────────────────────────────
dude lint:      ✓
dude api sync:  ✓ → @/openapi/api/<resource>
Next: wire it into a page with /create-page
```
