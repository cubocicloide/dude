<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/react-django.md -->

# `react-django`

React (Vite) frontend with a Django REST Framework backend — optional S3 storage and AWS ECS Fargate IaC.

**Built with:** `React 19` · `Vite` · `Django REST Framework` · `drf-spectacular` · `Celery`

---

## Scaffold it

```bash
dude init my-app --stack react-django
```

The questions `dude init` asks for this stack — pass the matching flag to
answer it non-interactively. Flag names ignore case and dashes, so
`--celery-beat`, `--celeryBeat` and `--celerybeat` are the same flag.

| Question | Flag | Default |
| -------- | ---- | ------- |
| Project name | `--project-name <value>` | `my-app` |
| Database (none = SQLite file, fine for dev) | `--database <none\|postgres>` | `none` |
| File storage (s3 = S3-compatible object storage; MinIO locally) | `--storage <none\|s3>` | `none` |
| Add Celery worker? | `--celery` | `false` |
| Add Celery Beat scheduler? (requires Celery — auto-enabled) | `--celery-beat` | `false` |
| Infrastructure-as-Code (Terraform, AWS ECS Fargate) | `--iac <none\|aws-ecs>` | `none` |

## What it is for

- A CRUD/admin-heavy web app that benefits from Django's batteries (admin, ORM, auth)
- An API that needs auto-generated OpenAPI docs (drf-spectacular) behind a React frontend
- S3-compatible file storage (MinIO locally) with a straightforward path to AWS ECS Fargate

## Deploying to the cloud

This stack ships an infrastructure-as-code target: **aws-ecs**.
Enable it at scaffold time with `--iac aws-ecs`, then use the `dude iac`
command group inside the generated project. The full deploy guide is part of
the project's own documentation — run `dude docs` after scaffolding.

## Conventions it enforces

`dude lint` runs **33 structural checks** for this stack, grouped by
area. Each one ships a prose rule file in the generated project under
`.claude/rules/`, so both you and a coding agent can see why a check exists
and how to fix a violation.

| Group | Checks |
| ----- | ------ |
| `BE` | 14 |
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
| `deploy.md` | Deploy (AWS ECS) | when `withIac` |

## Versions

- **Package:** [`@cubocicloide/stack-react-django`](https://www.npmjs.com/package/@cubocicloide/stack-react-django)
- **Requires dude:** `>= 0.1.0`

Both the CLI and the stack are pinned per project, so different projects can
sit on different versions. See [How it works](../concepts.md).
