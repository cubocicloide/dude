<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/react-fastapi.md -->

# `react-fastapi`

React (Vite) frontend with a FastAPI backend — Postgres, Celery and AWS EKS when you need them.

**Built with:** `React 19` · `Vite` · `FastAPI` · `SQLModel` · `Alembic` · `Celery`

---

## Scaffold it

```bash
dude init my-app --stack react-fastapi
```

The questions `dude init` asks for this stack — pass the matching flag to
answer it non-interactively. Flag names ignore case and dashes, so
`--celery-beat`, `--celeryBeat` and `--celerybeat` are the same flag.

| Question | Flag | Default |
| -------- | ---- | ------- |
| Project name | `--project-name <value>` | `my-app` |
| Database | `--database <none\|postgres>` | `none` |
| Add Celery worker? | `--celery` | `false` |
| Add Celery Beat scheduler? (requires Celery — auto-enabled) | `--celery-beat` | `false` |
| Infrastructure-as-Code (Terraform + Helm) | `--iac <none\|aws-eks>` | `none` |

## What it is for

- A CRUD/product web app that needs a typed REST API behind a modern SPA
- A Python + TypeScript team that wants Kubernetes-grade IaC (AWS EKS) once it scales
- Background/async work (Celery + Celery Beat) without leaving the Python backend

## Deploying to the cloud

This stack ships an infrastructure-as-code target: **aws-eks**.
Enable it at scaffold time with `--iac aws-eks`, then use the `dude iac`
command group inside the generated project. The full deploy guide is part of
the project's own documentation — run `dude docs` after scaffolding.

## Conventions it enforces

`dude lint` runs **30 structural checks** for this stack, grouped by
area. Each one ships a prose rule file in the generated project under
`.claude/rules/`, so both you and a coding agent can see why a check exists
and how to fix a violation.

| Group | Checks |
| ----- | ------ |
| `BE` | 11 |
| `E2E` | 7 |
| `FE` | 12 |

## Documentation inside the project

Every scaffolded project gets its own documentation site, served with
`dude docs`. This stack ships:

| Page | Title | Included |
| ---- | ----- | -------- |
| `index.md` | Home | always |
| `dude.md` | Working with dude | always |
| `api.md` | Command reference | always |
| `cheatsheet.md` | Cheatsheet | always |
| `mkdocs.md` | Writing docs | always |
| `deploy.md` | Deploy (AWS EKS) | when `withIac` |

## Versions

- **Package:** [`@cubocicloide/stack-react-fastapi`](https://www.npmjs.com/package/@cubocicloide/stack-react-fastapi)
- **Requires dude:** `>= 0.1.0`

Both the CLI and the stack are pinned per project, so different projects can
sit on different versions. See [How it works](../concepts.md).
