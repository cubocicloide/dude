---
name: create-tool
description: Add an MCP tool to an existing feature sub-server (FastMCP). Asks which feature, the tool name, parameters and return shape, checks the flat namespace for a name collision, surveys the feature's service and schemas for reuse, then creates the one-tool module, extends utils/service.py, adds any schema and writes the 1-to-1 test — all enforcing the MCP rules.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *) Bash(uv *)"
---

# Create Tool

Guided addition of a single **MCP tool** to a feature that already exists. One
tool is one module (MCP005), so this is a small, well-bounded change — but it
touches four files, and the rules in `.claude/rules/MCP/` decide the shape of
each one.

> If the feature does not exist yet, stop and use `/create-feature` instead —
> a tool cannot live outside a feature's `tools/` package (MCP004).

The same flow applies to a **resource** or a **prompt**; where the shape differs
it is called out at Step 5.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

List the features that exist:

```bash
ls "$PROJECT_ROOT"/fastmcp/app/features
```

If the target feature is not there, hand off to `/create-feature`.

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **Feature** — which existing feature owns this tool. Pick by bounded context,
   not by convenience; a tool that fits none of them is a signal to create a
   feature instead.
2. **Tool name** — `snake_case` (MCP012). It is simultaneously the module name,
   the function name and the name the model calls (MCP005).
3. **Parameters** — name and type for each. Every one is annotated (MCP007) and
   becomes part of the JSON schema the client sees.
4. **Return shape** — a scalar, a Pydantic model from `app/schemas/`, or a list
   of them. It must be annotated too.
5. **Failure modes** — what predictable failures exist, and what message the
   client should see (they become `ToolError`, MCP016).
6. **Does it need `Context`?** — progress reporting, logging back to the client,
   or sampling. If yes, the tool becomes `async def … (…, ctx: Context)` (MCP009).

---

## Step 2 — Survey the feature (reuse before create)

Run these and **read** what matters:

```bash
F=<feature>
ls  "$PROJECT_ROOT"/fastmcp/app/features/$F/tools/
cat "$PROJECT_ROOT"/fastmcp/app/features/$F/utils/service.py
ls  "$PROJECT_ROOT"/fastmcp/app/schemas/*.py
```

- **Sibling tool** — read the closest existing tool in that feature and mirror
  its imports, docstring style and error handling.
- **Service function** — does `utils/service.py` already implement this logic, or
  can an existing function be extended? Add to the service rather than starting a
  parallel one.
- **Existing schema** — reuse a model from `app/schemas/` if one fits; only add a
  module when nothing does (MCP011).

**Collision check (MCP013)** — all features mount into one flat namespace, so the
tool name must be unique across the **whole server**, not just this feature:

```bash
ls "$PROJECT_ROOT"/fastmcp/app/features/*/tools/
```

Those module stems are the live tool names (MCP005 forces function name = stem).
If the planned name is taken, rename before writing — at mount time a duplicate
silently shadows and one of the two disappears with no error.

Report what you found and what you intend to reuse.

---

## Step 3 — Plan the file set (confirm before writing)

Present the list, then wait for an OK:

| File | Rule | Purpose |
|------|------|---------|
| `features/<f>/tools/<tool>.py` | MCP004–MCP009 | **create** — exactly one `@server.tool` named `<tool>` |
| `features/<f>/utils/service.py` | MCP008 | **edit** — the logic the tool delegates to |
| `schemas/<entity>.py` | MCP011 | **create/edit** — only if the return shape needs a new model |
| `tests/features/<f>/tools/test_<tool>.py` | MCP017 | **create** — 1-to-1 with the tool module |
| `tests/features/<f>/utils/test_service.py` | MCP017 | **edit** — cover the new service function, including its failure path |
| `config.py` | MCP014 | **edit** — only if the tool needs a new env-driven setting |

Nothing else changes. In particular `tools/__init__.py` is **not** edited: it
calls `import_submodules(__name__, __path__)`, so dropping the module in is the
registration.

---

## Step 4 — Write the service function first

Business logic, I/O and persistence live in `utils/service.py`, never in the tool
module (MCP008). Predictable failures raise `DomainError` — the service must not
import FastMCP, which is what keeps it unit-testable:

```python
# features/<f>/utils/service.py
from app.core.errors import DomainError


def divide(a: float, b: float) -> float:
    if b == 0:
        raise DomainError("division by zero is undefined")
    return a / b
```

---

## Step 5 — Write the tool module

```python
# features/<f>/tools/<tool>.py  (MCP005, MCP006, MCP007, MCP008, MCP016)
"""<tool> — <one line>."""

from app.core.errors import DomainError, ToolError
from app.features.<f>._server import server
from app.features.<f>.utils import service
from app.schemas.<entity> import <Entity>


@server.tool
def <tool>(<param>: <type>) -> <Entity>:
    """<What the model should know to call this correctly.>"""
    try:
        return service.<fn>(<param>)
    except DomainError as exc:
        raise ToolError(str(exc)) from exc
```

Every line of that shape is load-bearing:

- **Module docstring + function docstring** — the function's is the tool's
  description, the text the model reads when deciding to call it (MCP006).
- **Function name = module stem**, exactly one decorated function in the file
  (MCP005).
- **All parameters and the return annotated** — FastMCP derives the JSON schema
  from them (MCP007). Use `-> None` when nothing is returned.
- **No I/O imports, no `open(`, no class definitions** in this module, and keep
  the body under ~15 statements (MCP008).
- **Only `ToolError` is raised**, and never `assert` (MCP016).
- **No `print(`** — it corrupts the stdio JSON-RPC transport (MCP015).

Needs the context? Then it is `async` and the parameter is named `ctx` (MCP009):

```python
from fastmcp import Context


@server.tool
async def <tool>(text: str, ctx: Context) -> str:
    """<description>"""
    await ctx.info("working")
    return service.<fn>(text)
```

**If you are adding a resource instead**, the module goes in `resources/` with
`@server.resource("scheme://…")`, and the URI's `{placeholders}` must match the
non-`ctx` parameters one-to-one — a static resource takes no parameters (MCP010).
**A prompt** goes in `prompts/` with `@server.prompt` and returns the prompt
string. Everything else above is identical.

---

## Step 6 — Write the tests (MCP017)

Two tests, both required in the same change:

```python
# tests/features/<f>/tools/test_<tool>.py — through an in-memory MCP client
"""Integration test for the `<tool>` tool."""

import pytest
from fastmcp.exceptions import ToolError

from app.features.<f> import server as <f>_server


@pytest.mark.asyncio
async def test_<tool>(make_client) -> None:
    async with make_client(<f>_server) as client:
        result = await client.call_tool("<tool>", {"<param>": <value>})
    assert result.data.<field> == <expected>


@pytest.mark.asyncio
async def test_<tool>_surfaces_tool_error(make_client) -> None:
    async with make_client(<f>_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool("<tool>", {"<param>": <bad value>})
```

…plus a pure unit test for the new service function in
`tests/features/<f>/utils/test_service.py`, covering the `DomainError` path.

`make_client` comes from `tests/conftest.py`; `asyncio_mode` is **strict**, so
every async test needs `@pytest.mark.asyncio`. Assert on real behaviour — a test
that only checks the call succeeds adds nothing.

---

## Step 7 — Verify

```bash
cd "$PROJECT_ROOT"
dude lint --format json          # must report errorCount 0
dude test --k <tool>             # the new tests
```

For any diagnostic, read the rule before editing:

```bash
dude explain MCP005
```

Fix the cause, never work around the check. MCP017 reports a missing test as a
**warning**, so read the `diagnostics` array — a zero exit code is not proof of
coverage.

Then confirm the tool is actually registered and visible in the flat namespace
(the failure the lint rules cannot see):

```bash
cd "$PROJECT_ROOT/fastmcp"
uv run python -c "
import asyncio
from fastmcp import Client
from app.server import create_server

async def main():
    async with Client(create_server()) as c:
        print(sorted(t.name for t in await c.list_tools()))

asyncio.run(main())
"
```

The new name must appear exactly once. Finally:

```bash
cd "$PROJECT_ROOT"
dude test                        # the full suite
dude review                      # dude lint + ruff + mypy --strict
```

---

## Step 8 — Report

```
Tool created
═════════════════════════════════════════
Tool        <tool>  (feature: <f>)
Module      fastmcp/app/features/<f>/tools/<tool>.py
Service     features/<f>/utils/service.py — <fn> <added | extended>
Schema      <created | reused | n/a>
Tests       tests/features/<f>/tools/test_<tool>.py
            tests/features/<f>/utils/test_service.py (extended)
Registration  none needed — import_submodules picked it up
─────────────────────────────────────────
dude lint:  ✓ 0 errors, <n> warnings
list_tools: ✓ "<tool>" visible, no collision
dude test:  ✓
```
