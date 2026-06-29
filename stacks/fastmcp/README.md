# @cubocicloide/stack-fastmcp

A `dude` stack plugin that scaffolds and lints a **FastMCP** (Python) server — a
modular monolith of feature sub-servers exposing MCP **tools**, **resources**
(incl. templates), and **prompts**.

## What it scaffolds

A Dockerised FastMCP project laid out like the `react-fastapi` backend: a
`docker-compose.yml` at the root and a `fastmcp/` service folder (the analogue of
`backend/`) holding its `Dockerfile`, `pyproject.toml` (uv, py3.13,
ruff/mypy/pytest), and an `app/` package with everything inside — including the
tests under `app/tests/`.

```
.
├── docker-compose.yml          # the fastmcp service (HTTP) + MCP Inspector (dev profile)
└── fastmcp/                     # the service (analogous to backend/)
    ├── Dockerfile
    ├── pyproject.toml
    ├── start.sh
    └── app/
        ├── __main__.py          # `python -m app` — wires transport from settings
        ├── server.py            # create_server(): discover + mount feature sub-servers
        ├── config.py            # Settings(BaseSettings) — the ONLY env reader
        ├── core/errors.py       # DomainError (service) → ToolError (client-facing)
        ├── schemas/             # pydantic models; module name = class prefix (MCP011)
        ├── utils/               # global helpers (discovery.import_submodules, …)
        ├── features/            # one package per bounded context (calculator, notes)
        │   └── <feature>/
        │       ├── _server.py   #   server = FastMCP(name="<feature>")
        │       ├── tools/       #   ONE @server.tool per module
        │       ├── resources/   #   ONE @server.resource per module
        │       ├── prompts/     #   ONE @server.prompt per module
        │       └── utils/       #   service.py (pure logic) + feature helpers
        └── tests/               # mirrors app/ 1:1
```

## Commands

`up`, `down`, `logs`, `shell`, `lint`, `format`, `review`, `test`, `docs`,
`security`. (No `iac`, `api`, or `db` — this stack ships a single Python service.)

## Lint rules

17 deterministic MCP rules (`MCP001`–`MCP017`) enforce the architecture above —
structure & wiring, component placement/purity, schema conventions, name
collisions, centralised config, and 1-to-1 test coverage. Each rule has a
matching prose description in the generated project's `.claude/rules/MCP/`.

See the generated project's `docs/` and `.claude/rules/` for the full reference.
