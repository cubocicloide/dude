# Stacks

A **stack** is a versioned blueprint for a whole application: the templates to
scaffold it, the lint rules that keep it consistent, and the commands to run and
ship it. Pick one at `dude init` with `--stack <id>`.

```bash
dude init my-app --stack react-fastapi
```

---

## Available stacks

### `react-fastapi`

A full-stack web application: **React 19** (Vite, TypeScript strict, Ant Design,
TanStack Query) on the frontend, **FastAPI** (SQLModel, Pydantic v2, Python
≥ 3.13, uv) on the backend. Optional PostgreSQL + Alembic, Celery + Redis
background jobs, and a typed OpenAPI client kept in sync with the running
backend. Cloud IaC targets **AWS EKS** (Terraform + Helm) via `--iac aws-eks`.

### `react-django`

React frontend with a **Django REST Framework** backend (drf-spectacular for the
OpenAPI schema). Optional S3-compatible object storage (MinIO locally), Celery
background jobs. Cloud IaC targets **AWS ECS Fargate** via `--iac aws-ecs`.

### `fastmcp`

A **FastMCP (Python) server** — a Model Context Protocol server organised as
modular feature sub-servers. Optional AWS ECS Fargate IaC.

### `tauri`

A **Tauri 2** application — desktop plus iOS/Android — with a React + Ant Design
frontend and a Rust backend. Ships dev/build commands, mobile (android/ios)
init/dev/build, a `doctor` for mobile SDKs, and optional SQLite.

### `frappe`

A **Frappe Framework** ticketing system built on Frappe Helpdesk, plus a
worked-example custom app. Cloud IaC targets **AWS ECS Fargate** via
`--iac aws-ecs`.

### `airflow`

An **Apache Airflow** deployment with a worked-example set of DAGs. Optional
single-sign-on and ECS-executor cloud IaC.

---

## Choosing a stack

| If you're building…                          | Use            |
| -------------------------------------------- | -------------- |
| A web app with a Python API                  | `react-fastapi` or `react-django` |
| A desktop or mobile app                      | `tauri`        |
| An MCP server for AI tooling                 | `fastmcp`      |
| A ticketing / helpdesk system                | `frappe`       |
| Data pipelines / workflow orchestration      | `airflow`      |

!!! tip "Not sure what's inside a stack?"
    Scaffold it and run `dude help` — the command catalog reflects exactly what
    that stack (and your init choices) provides. Then `dude docs` opens the full
    reference for the generated project.

---

## What every stack gives you

However different the technologies, the workflow is the same across stacks:

- `dude up` / `dude down` — run the project locally in Docker.
- `dude lint` — enforce the stack's structural conventions.
- `dude test` — run the project's test suites.
- `dude docs` — serve the project's own documentation site.
- Optional `dude iac …` — provision and ship to the cloud, when the stack
  supports it and you enabled IaC at init.

The exact command set is always discoverable with `dude help` inside the
project.
