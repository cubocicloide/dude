---
paths:
  - "backend/**"
---

# Backend Conventions (BE001–BE011)

These rules are enforced by `dude lint` (codes BE001–BE011). Violations block CI.

---

## BE001 — Required `backend/app/` structure

`backend/app/` must contain **all** of the following directories and files. Missing any item is an error.

**Required directories:**
```
backend/app/
  core/
  fixtures/
  management/
  models/
  queries/
  routers/
  schemas/
  tests/
  utils/
```

**Required root files:** `main.py`, `__init__.py`

**Required layout inside `tests/`:**
```
backend/app/tests/
  models/
  queries/
  routers/
  utils/
  __init__.py
  conftest.py
```

When adding a new subdomain (e.g. a new resource), always create all required files in the same PR.

---

## BE002 — Model class naming

Each `backend/app/models/foo.py` must define a class named `Foo` (snake_case filename → PascalCase class name).

| File | Required class |
|------|---------------|
| `models/user.py` | `class User` |
| `models/todo_item.py` | `class TodoItem` |

One class per file is the expected norm (see BE010 below).

---

## BE003 — Schema class conventions

Every class defined in `backend/app/schemas/foo.py` must:

1. **Extend `BaseModel` or `SQLModel`** — only Pydantic/SQLModel schemas are allowed in `schemas/`.
2. **Be named with the PascalCase prefix** derived from the filename.

| File | Valid class names |
|------|------------------|
| `schemas/todo.py` | `Todo`, `TodoCreate`, `TodoUpdate`, `TodoRead` |
| `schemas/user_profile.py` | `UserProfile`, `UserProfileCreate`, … |

Helper classes (e.g. enums, mixins) must not be placed in `schemas/`; put them in `utils/` or a dedicated module.

---

## BE004 — Router definition

Every file in `backend/app/routers/` (except `__init__.py`) must define a module-level router:

```python
router = APIRouter(...)
```

The variable must be named `router` exactly.

---

## BE005 — Router registration in `main.py`

`backend/app/main.py` must import and register **every** module in `routers/`, and **only** those modules.

- Import form: `from app.routers import foo, bar`
- Registration form: `app.include_router(foo.router, ...)`

Adding a new router file → update `main.py` in the same PR. Removing a router file → remove its import and `include_router` call.

---

## BE006 — Router filename convention

Router filenames must follow this pattern:

```
{resource}[_{sub-resource}][__{path-param}].py
```

- All segments are **lowercase alphanumeric**.
- `_` separates sub-resources (literal path segments).
- `__` introduces a path parameter.

| Filename | Maps to path prefix |
|----------|---------------------|
| `todos.py` | `/todos` |
| `todos__id.py` | `/todos/{id}` |
| `users_me.py` | `/users/me` |
| `keycloak_token.py` | `/keycloak/token` |

---

## BE007 — Router file contents & path consistency

A router file may contain **only** `@router.METHOD`-decorated async functions (no standalone helpers, no classes, no utility functions — put those in `utils/`).

Each route's path must match the path derived from the filename (see BE006):

```python
# File: routers/todos__id.py
@router.get("/{id}")   # ✓ correct
@router.get("/todos/{id}")  # ✗ wrong — prefix is determined by include_router in main.py
```

Path derivation rules (applied to the filename stem):
- `__param` → `/{param}` (path parameter segment)
- `_segment` → `/segment` (literal segment)
- All routes in the file must share this base path prefix.

---

## BE008 — Test coverage (1-to-1)

Every source file in `models/`, `queries/`, `routers/`, and `utils/` must have a corresponding test file, and vice-versa.

| Source | Expected test |
|--------|---------------|
| `models/todo.py` | `tests/models/test_todo.py` |
| `routers/todos.py` | `tests/routers/test_todos.py` |

- **Warning**: source exists, test is missing → add the test.
- **Error**: test exists, source is missing → orphaned test; remove it or create the source file.

When adding a new source file, always create the corresponding test file in the same PR.

---

## BE009 — Centralised environment variables

All environment variables must be accessed **exclusively** in `backend/app/core/config.py` via a `BaseSettings` subclass. Using `os.getenv` or `os.environ` anywhere else is an error.

```python
# core/config.py — correct
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    DEBUG: bool = False

settings = Settings()
```

```python
# routers/todos.py — wrong
import os
db_url = os.getenv("DATABASE_URL")  # BE009 error
```

**Additional rule**: fields inside the `Settings` class must be declared in **alphabetical order**.

To add a new env var: add it to `Settings` in `core/config.py`, then reference it as `settings.MY_VAR` everywhere else.

---

## BE010 — One model class per file

Each file in `backend/app/models/` must define **exactly one class**, named after the file (snake_case → PascalCase).

```
models/todo.py       → class Todo          (one class, correct name)
models/todo.py       → class Todo, TodoMeta  ✗ BE010 — two classes
models/todo.py       → class Task            ✗ BE010 — wrong name
```

If you need helper types, put them in `schemas/` or `utils/`, not in `models/`.

---

## BE011 — Query class naming

Each class in `backend/app/queries/foo.py` must be named with the PascalCase prefix from the filename. Multiple classes per file are allowed (one per operation is the norm).

| File | Valid class names |
|------|------------------|
| `queries/todos.py` | `Todos`, `TodosList`, `TodosCreate`, `TodosById`, … |
| `queries/users.py` | `Users`, `UsersMe`, `UsersDelete`, … |

A file with no classes at all is an error.
