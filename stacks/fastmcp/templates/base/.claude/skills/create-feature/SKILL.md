---
name: create-feature
description: Scaffold a new MCP feature sub-server (FastMCP). Asks what the feature exposes, surveys the existing features for reusable services, schemas and name collisions, then creates features/<name>/ with _server.py, the package __init__, the component modules, utils/service.py, any schema and the 1-to-1 tests — all enforcing the MCP rules. server.py is never edited; the loader discovers the feature.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *) Bash(mkdir *) Bash(uv *)"
---

# Create Feature

Guided creation of a **feature sub-server** — a bounded context under
`fastmcp/app/features/<name>/` that exposes MCP tools, resources and/or prompts,
satisfying every rule in `.claude/rules/MCP/`. The skill **inspects the existing
features first** so a new feature reuses existing schemas and helpers, and does
not collide with a component name that already exists.

> Read `.claude/rules/MCP/001.md`–`017.md` once at the start — they are the
> source of truth. The summary below tracks them but the rule files win.
> `dude explain` with no argument lists every rule that applies to this project;
> `dude explain MCP008` prints one.

The root server needs **no** edit: `app/server.py` walks `features/`, imports
each non-underscore package and mounts its exported `server`. Adding a feature is
a pure drop-in.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

The Python service always lives at `fastmcp/app/` — call it `APP`:

```bash
ls "$PROJECT_ROOT/fastmcp/app"
```

If that directory is absent, stop: the service has not been scaffolded (MCP001).

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **Feature name** — `snake_case`; it becomes the folder **and** the mounted
   sub-server name (MCP003, MCP012). Prefer a plural bounded context
   (`notes`, `widgets`, `invoices`), not a verb.
2. **What it exposes** — at least one of tools / resources / prompts (MCP002):
   - **tool** — an action the model can call
   - **resource** — addressable read-only data (`scheme://…`, optionally templated)
   - **prompt** — a reusable prompt the client can fetch
3. **For each component** — its name, parameters (with types) and return type.
4. **State / I/O** — does the feature hold state, call an API, or touch a
   database? That logic goes in `utils/service.py`, never in a component (MCP008).
5. **Schemas** — does a component return a structured object? Then it needs a
   Pydantic model in `app/schemas/` (MCP011).

---

## Step 2 — Survey the existing code (reuse before create)

Run these and **read the relevant matches** before proposing anything:

```bash
ls "$PROJECT_ROOT"/fastmcp/app/features
ls "$PROJECT_ROOT"/fastmcp/app/schemas/*.py
ls "$PROJECT_ROOT"/fastmcp/app/utils/*.py
ls "$PROJECT_ROOT"/fastmcp/app/features/*/tools/ "$PROJECT_ROOT"/fastmcp/app/features/*/prompts/ 2>/dev/null
grep -rn "@server.resource(" "$PROJECT_ROOT"/fastmcp/app/features/*/resources/
```

- **Closest existing feature** — mirror its structure, imports and style. The
  scaffold ships two deliberately different shapes:

  | Feature | Shape to copy when… |
  |---------|---------------------|
  | `calculator` | stateless pure logic; tools returning a schema; static resources |
  | `notes` | stateful store, a tool using `ctx: Context`, a templated resource, a prompt |

- **Existing schema** — if a model already describes this entity
  (`schemas/<entity>.py`), reuse it. Only add a new module if none fits (MCP011).
- **Global helpers** — `app/utils/` (e.g. `discovery.import_submodules`) and
  `app/core/errors.py` (`DomainError`, `ToolError`) already exist; import them
  rather than redefining.
- **Collision check (MCP013)** — every feature mounts into **one flat
  namespace**. The tool/prompt module stems listed above *are* the live names
  (MCP005 forces the function name to equal the module stem), and the grep gives
  every resource URI in use. If a planned name is taken, rename now — at mount
  time a duplicate silently shadows and the loser disappears.

Report what you found, what you intend to reuse, and any renames the collision
check forced.

---

## Step 3 — Fix the feature's identity (MCP003, MCP012)

| Thing | Value | Rule |
|-------|-------|------|
| Folder | `fastmcp/app/features/<name>/` | `snake_case`, no leading `_` — the loader skips underscore-prefixed packages |
| Sub-server | `server = FastMCP(name="<name>")` in `_server.py` | the `name` must be a **string literal equal to the folder** |
| Test package | `fastmcp/app/tests/features/<name>/` | mirrors the source tree (MCP017) |

---

## Step 4 — Plan the file set (confirm before writing)

Present the full list of files to **create**, then wait for an OK. A feature with
one tool, one resource and a service touches:

| File | Rule | Purpose |
|------|------|---------|
| `features/<f>/__init__.py` | MCP002, MCP003 | re-export `server`, then `import_submodules(__name__, __path__)` so the decorators run |
| `features/<f>/_server.py` | MCP002, MCP003 | `server = FastMCP(name="<f>")` — nothing else |
| `features/<f>/tools/__init__.py` | MCP002 | auto-register every tool module |
| `features/<f>/tools/<x>.py` | MCP004–MCP009 | exactly one `@server.tool` named `<x>` |
| `features/<f>/resources/__init__.py` | MCP002 | auto-register every resource module |
| `features/<f>/resources/<x>.py` | MCP004–MCP010 | exactly one `@server.resource("scheme://…")` named `<x>` |
| `features/<f>/prompts/__init__.py` + `prompts/<x>.py` | MCP004–MCP007 | only if the feature ships prompts |
| `features/<f>/utils/__init__.py` | MCP002 | **required even when empty** — `utils/` is not optional |
| `features/<f>/utils/service.py` | MCP008 | the logic layer; raises `DomainError` |
| `schemas/<entity>.py` | MCP011 | Pydantic models, every class prefixed with the file's PascalCase — only if no existing schema fits |
| `tests/features/<f>/__init__.py` (+ one per component package and `utils/`) | — | test packages must be importable |
| `tests/features/<f>/tools/test_<x>.py` | MCP017 | 1-to-1 with the tool module |
| `tests/features/<f>/resources/test_<x>.py` | MCP017 | 1-to-1 with the resource module |
| `tests/features/<f>/utils/test_service.py` | MCP017 | 1-to-1 with the service |
| `config.py` | MCP014 | any new env var, added as a typed field on `Settings` |

Skip rows that don't apply. Two things that are **not** on the list:

- **`app/server.py`** — never edit it to register a feature. Discovery is automatic.
- A `tests/features/<f>/conftest.py` — add one only if the feature needs
  per-test isolation (see `tests/features/notes/conftest.py`, which resets the
  in-memory store).

---

## Step 5 — Implement

Follow the existing patterns exactly. Reference shapes:

```python
# features/widgets/_server.py  (MCP003)
"""The widgets sub-server instance (name matches the folder — MCP003)."""

from fastmcp import FastMCP

server = FastMCP(name="widgets")
```

```python
# features/widgets/__init__.py  (MCP002, MCP003)
"""widgets — <one line on what this bounded context does>.

Exports `server` and imports its component packages so every `@server.*` in them
registers. Importing the package fully populates the sub-server (MCP003).
"""

from app.features.widgets._server import server
from app.utils.discovery import import_submodules

import_submodules(__name__, __path__)

__all__ = ["server"]
```

```python
# features/widgets/tools/__init__.py  (MCP002)
"""Auto-register every tool module in this package (one tool per module)."""

from app.utils.discovery import import_submodules

import_submodules(__name__, __path__)
```

```python
# features/widgets/tools/resize_widget.py  (MCP004–MCP008, MCP016)
"""resize_widget — change a widget's dimensions."""

from app.core.errors import DomainError, ToolError
from app.features.widgets._server import server
from app.features.widgets.utils import service
from app.schemas.widget import Widget


@server.tool
def resize_widget(widget_id: str, width: int, height: int) -> Widget:
    """Resize a widget and return its updated state."""
    try:
        return service.store.resize(widget_id, width, height)
    except DomainError as exc:
        raise ToolError(str(exc)) from exc
```

```python
# features/widgets/utils/service.py  (MCP008)
"""Widget logic — pure and unit-testable, with no FastMCP import.

Tools are thin adapters over this module; swapping the store for a database
later touches only this file.
"""

from app.core.errors import DomainError
from app.schemas.widget import Widget


class WidgetStore:
    """In-memory widget repository."""

    def __init__(self) -> None:
        self._widgets: dict[str, Widget] = {}

    def resize(self, widget_id: str, width: int, height: int) -> Widget:
        if widget_id not in self._widgets:
            raise DomainError(f"widget '{widget_id}' not found")
        ...


store = WidgetStore()
```

```python
# features/widgets/resources/widget.py  (MCP010)
"""widget — read a single widget by id (resource template)."""

from typing import Any

from app.features.widgets._server import server
from app.features.widgets.utils import service


@server.resource("widget://{widget_id}", mime_type="application/json")
def widget(widget_id: str) -> dict[str, Any]:
    """Read a single widget by id."""
    return service.store.get(widget_id).model_dump()
```

```python
# tests/features/widgets/tools/test_resize_widget.py  (MCP017)
"""Integration test for the `resize_widget` tool."""

import pytest

from app.features.widgets import server as widgets_server


@pytest.mark.asyncio
async def test_resize_widget(make_client) -> None:
    async with make_client(widgets_server) as client:
        result = await client.call_tool("resize_widget", {"widget_id": "1", "width": 4, "height": 2})
    assert result.data.width == 4
```

`make_client` and `app` are shared fixtures from `tests/conftest.py` — use them
rather than constructing a client by hand. `asyncio_mode` is **strict**, so every
async test needs `@pytest.mark.asyncio`.

Constraints to honour while writing:

- One component per module, function named after the module stem (MCP005); the
  decorator kind must match the package it lives in (MCP004).
- Every component has a **docstring** — it is the description the model reads —
  and **full type annotations** on every parameter and the return (MCP006, MCP007).
- Component bodies stay thin: no `httpx`/`requests`/`sqlalchemy`/`boto3`/… imports,
  no `open(`, no class definitions, ideally under 15 statements (MCP008).
- Need the MCP `Context`? The parameter is named exactly `ctx`, annotated
  `Context`, and its function is `async def` (MCP009).
- Resource URIs carry a scheme, and their `{placeholders}` match the non-`ctx`
  parameters one-to-one — a static resource takes no parameters (MCP010).
- Services raise `DomainError`; components catch it and raise `ToolError`. Never
  raise a bare `Exception` and never `assert` for control flow (MCP016).
- No `print(` anywhere under `app/` — it corrupts the stdio JSON-RPC transport.
  Use `await ctx.info(...)` for the client, `logging` for operators (MCP015).
- Read env vars only in `app/config.py` (MCP014).
- Write meaningful tests, not smoke tests: an in-memory client test per component
  (mirroring `tests/features/notes/tools/test_create_note.py`) **plus** a pure
  unit test for the service (mirroring
  `tests/features/calculator/utils/test_service.py`), covering the failure path.

---

## Step 6 — Verify

```bash
cd "$PROJECT_ROOT"
dude lint --format json          # must report errorCount 0
dude test --k <component_name>   # narrow to one component while iterating
```

`--k` is a pytest `-k` expression and matches **test function/module names**, not
directories — use a component name (`resize_widget`), not the feature folder.

For any diagnostic, read the rule before editing:

```bash
dude explain MCP008
```

Fix the cause and re-run — never work around a check. Note that MCP017 reports a
missing test as a **warning**, so a clean exit code is not proof of coverage:
read the `diagnostics` array, not just `errorCount`.

Then confirm the feature is actually discovered and mounted (the one failure the
lint rules cannot see — a registration mistake in `__init__.py`):

```bash
cd "$PROJECT_ROOT/fastmcp"
uv run python -c "from app.server import discover_feature_servers; print(sorted(s.name for s in discover_feature_servers()))"
```

The new name must appear in that list. Finally:

```bash
cd "$PROJECT_ROOT"
dude test                        # the full suite
dude review                      # dude lint + ruff + mypy --strict
```

---

## Step 7 — Report

```
Feature created
═════════════════════════════════════════
Feature     <name>  (mounted as "<name>")
Sub-server  fastmcp/app/features/<name>/_server.py
Tools       <x>, <y>            (or n/a)
Resources   <uri>               (or n/a)
Prompts     <x>                 (or n/a)
Service     features/<name>/utils/service.py
Schema      <created | reused | n/a>
Tests       tests/features/<name>/… (N files)
server.py   untouched — discovered automatically
─────────────────────────────────────────
dude lint:  ✓ 0 errors, <n> warnings
discovery:  ✓ "<name>" mounted
dude test:  ✓
Next: add another tool with /create-tool
```
