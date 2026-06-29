---
"@cubocicloide/stack-fastmcp": minor
"@cubocicloide/dude": patch
---

feat(fastmcp): introduce the `fastmcp` stack plugin

Adds `@cubocicloide/stack-fastmcp` — a new official `dude` stack for Python
MCP servers built with [FastMCP 3.4+](https://github.com/jlowin/fastmcp).

**What's in the stack**

- Scaffold command (`dude init --stack fastmcp`) that generates a modular
  FastMCP monolith: main server in `fastmcp/app/`, feature sub-servers mounted
  via `fastmcp.mount()`, Pydantic schemas, shared utilities, and a full pytest
  suite.
- Docker Compose setup: `fastmcp` service (HTTP transport) + optional
  MCP Inspector UI behind the `dev` Docker Compose profile.
- Commands: `up`, `down`, `logs`, `shell`, `lint`, `format`, `review`, `test`,
  `docs`, `security`.
- 17 deterministic lint rules (MCP001–MCP017) covering: required project
  structure, feature package shape, sub-server contract, component placement,
  one-component-per-module, docstrings, type annotations, thin binding layer,
  Context convention, resource URI↔param parity, Pydantic schema conventions,
  snake_case naming, name/URI uniqueness, environment access isolation, no
  `print()` in production, error handling (ToolError only), and 1-to-1 test
  parity.
- Matching `.claude/rules/MCP/NNN.md` prose files in the generated project so
  Claude Code understands every rule and can guide developers to fix violations.
- MkDocs Material docs site with a `connect.md` page covering Inspector,
  Claude Desktop (stdio), and Claude Code integration.

**Core fix (dude CLI)**

`template-runner.ts`: the `_x` → `.x` dotfile rename rule now skips any file
whose target name ends in `.py`, so Python private modules like `_server.py`
survive scaffolding intact. Dotfiles never end in `.py`, so this is safe for
all existing stacks.
