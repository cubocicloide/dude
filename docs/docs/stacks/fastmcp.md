<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/fastmcp.md -->

# `fastmcp`

A FastMCP (Python) server — modular MCP feature sub-servers, with optional AWS ECS Fargate IaC.

**Built with:** `FastMCP` · `Python` · `Pydantic`

---

## Scaffold it

```bash
dude init my-app --stack fastmcp
```

The questions `dude init` asks for this stack — pass the matching flag to
answer it non-interactively. Flag names ignore case and dashes, so
`--celery-beat`, `--celeryBeat` and `--celerybeat` are the same flag.

| Question | Flag | Default |
| -------- | ---- | ------- |
| Project name | `--project-name <value>` | `my-mcp` |
| Infrastructure-as-Code (Terraform, AWS ECS Fargate) | `--iac <none\|aws-ecs>` | `none` |

## What it is for

- An MCP server exposing tools/resources to LLM clients over a typed Python API
- A modular monolith of MCP feature sub-servers that can grow independently
- A lightweight service that ships to AWS ECS Fargate without a Kubernetes footprint

## Deploying to the cloud

This stack ships an infrastructure-as-code target: **aws-ecs**.
Enable it at scaffold time with `--iac aws-ecs`, then use the `dude iac`
command group inside the generated project. The full deploy guide is part of
the project's own documentation — run `dude docs` after scaffolding.

## Conventions it enforces

`dude lint` runs **17 structural checks** for this stack, grouped by
area. Each one ships a prose rule file in the generated project under
`.claude/rules/`, so both you and a coding agent can see why a check exists
and how to fix a violation.

| Group | Checks |
| ----- | ------ |
| `MCP` | 17 |

## Documentation inside the project

Every scaffolded project gets its own documentation site, served with
`dude docs`. This stack ships:

| Page | Title | Included |
| ---- | ----- | -------- |
| `index.md` | Home | always |
| `dude.md` | Working with dude | always |
| `connect.md` | Connecting a client | always |
| `architecture.md` | Architecture | always |
| `deploy.md` | Deploy (AWS ECS) | when `withIac` |
| `api.md` | Command reference | always |
| `mkdocs.md` | Writing docs | always |

## Versions

- **Package:** [`@cubocicloide/stack-fastmcp`](https://www.npmjs.com/package/@cubocicloide/stack-fastmcp)
- **Requires dude:** `>= 0.1.0`

Both the CLI and the stack are pinned per project, so different projects can
sit on different versions. See [How it works](../concepts.md).
