<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/index.md -->

# Stacks

A **stack** is a versioned blueprint for a whole application: the templates to
scaffold it, the lint rules that keep it consistent, and the commands to run and
ship it. Pick one at `dude init` with `--stack <id>`.

```bash
dude init my-app --stack react-fastapi
```

---

## Available stacks

### [`airflow`](airflow.md)

An Apache Airflow project — organized DAGs & plugins, native or Entra ID SSO, optional AWS ECS Fargate IaC.

### [`fastmcp`](fastmcp.md)

A FastMCP (Python) server — modular MCP feature sub-servers, with optional AWS ECS Fargate IaC.

### [`frappe`](frappe.md)

A Frappe Framework ticketing system (Frappe Helpdesk) with a worked custom-app example and optional AWS ECS Fargate IaC.

### [`react-django`](react-django.md)

React (Vite) frontend with a Django REST Framework backend — optional S3 storage and AWS ECS Fargate IaC.

### [`react-fastapi`](react-fastapi.md)

React (Vite) frontend with a FastAPI backend — Postgres, Celery and AWS EKS when you need them.

### [`tauri`](tauri.md)

A Tauri 2 desktop app — React + Ant Design frontend, Rust backend, with iOS/Android targets.

---

## At a glance

| Stack | Cloud target | Lint groups | Checks | Requires dude |
| ----- | ------------ | ----------- | -----: | ------------- |
| [`airflow`](airflow.md) | `aws-ecs` | `AF` | 10 | `>= 0.1.0` |
| [`fastmcp`](fastmcp.md) | `aws-ecs` | `MCP` | 17 | `>= 0.1.0` |
| [`frappe`](frappe.md) | `aws-ecs` | `APP`, `DT`, `PY` | 11 | `>= 0.1.0` |
| [`react-django`](react-django.md) | `aws-ecs` | `BE`, `E2E`, `FE` | 33 | `>= 0.1.0` |
| [`react-fastapi`](react-fastapi.md) | `aws-eks` | `BE`, `E2E`, `FE` | 30 | `>= 0.1.0` |
| [`tauri`](tauri.md) | — | `BE`, `FE` | 23 | `>= 0.1.0` |

## Choosing a stack

| If you're building… | Use |
| ------------------- | --- |
| A team orchestrating scheduled data pipelines (DAGs) with a clear, lint-enforced structure | [`airflow`](airflow.md) |
| Enterprise sign-on via Microsoft Entra ID OAuth (or Airflow's native auth) for the web UI | [`airflow`](airflow.md) |
| Bursty, heavy tasks that need their own container via the hybrid AWS ECS executor, without a full Kubernetes cluster | [`airflow`](airflow.md) |
| An MCP server exposing tools/resources to LLM clients over a typed Python API | [`fastmcp`](fastmcp.md) |
| A modular monolith of MCP feature sub-servers that can grow independently | [`fastmcp`](fastmcp.md) |
| A lightweight service that ships to AWS ECS Fargate without a Kubernetes footprint | [`fastmcp`](fastmcp.md) |
| A ticketing/helpdesk system running Frappe Helpdesk out of the box | [`frappe`](frappe.md) |
| A team learning Frappe's core building blocks via a worked custom-app example | [`frappe`](frappe.md) |
| A DocType/workflow-driven backend with a straightforward path to AWS ECS Fargate | [`frappe`](frappe.md) |
| A CRUD/admin-heavy web app that benefits from Django's batteries (admin, ORM, auth) | [`react-django`](react-django.md) |
| An API that needs auto-generated OpenAPI docs (drf-spectacular) behind a React frontend | [`react-django`](react-django.md) |
| S3-compatible file storage (MinIO locally) with a straightforward path to AWS ECS Fargate | [`react-django`](react-django.md) |
| A CRUD/product web app that needs a typed REST API behind a modern SPA | [`react-fastapi`](react-fastapi.md) |
| A Python + TypeScript team that wants Kubernetes-grade IaC (AWS EKS) once it scales | [`react-fastapi`](react-fastapi.md) |
| Background/async work (Celery + Celery Beat) without leaving the Python backend | [`react-fastapi`](react-fastapi.md) |
| A cross-platform desktop app (macOS/Windows/Linux) with a native feel and small binaries | [`tauri`](tauri.md) |
| The same codebase extended to iOS and Android | [`tauri`](tauri.md) |
| A React + Ant Design UI backed by a Rust core for performance-sensitive logic | [`tauri`](tauri.md) |

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
project — it reflects your init answers and any project-local commands.
