# @cubocicloide/stack-fastmcp

## 0.3.2

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

## 0.3.1

### Patch Changes

- 846c277: Fix `dude iac apply` failing with `InvalidParameterValue: ... Character sets
beyond ASCII are not supported` for the `aws-ecs` IaC target. The `alb` and
  `service` security group descriptions used an em-dash, which AWS's
  `CreateSecurityGroup` API rejects; replaced with a plain hyphen.

## 0.3.0

### Minor Changes

- 98e5de4: Add AWS deployment support to the fastmcp stack (`--iac aws-ecs`): the init flow
  now asks for an IaC target (none / aws-ecs). Choosing `aws-ecs` scaffolds
  Terraform for a single ECS Fargate service behind an ALB (SSE-friendly idle
  timeout, `/health` target-group probe, optional ACM + Route53 HTTPS), a shared
  bootstrap (S3 state + DynamoDB lock + ECR repository), a production Dockerfile,
  an IaC runner image and a deploy docs page — plus the full `dude iac` command
  group (login, new-env, bootstrap, init, plan, apply, build, push, deploy, ship,
  status, logs, output, fmt, validate, shell, destroy). The base template gains a
  plain-HTTP `/health` route on the server for load-balancer health checks.

## 0.2.0

### Minor Changes

- 2537e53: feat(fastmcp): introduce the `fastmcp` stack plugin

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

### Patch Changes

- Updated dependencies [2537e53]
  - @cubocicloide/dude@0.11.1
