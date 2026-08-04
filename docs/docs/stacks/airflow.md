<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/airflow.md -->

# `airflow`

An Apache Airflow project — organized DAGs & plugins, native or Entra ID SSO, optional AWS ECS Fargate IaC.

**Built with:** `Apache Airflow 3` · `PostgreSQL`

---

## Scaffold it

```bash
dude init my-app --stack airflow
```

The questions `dude init` asks for this stack — pass the matching flag to
answer it non-interactively. Flag names ignore case and dashes, so
`--celery-beat`, `--celeryBeat` and `--celerybeat` are the same flag.

| Question | Flag | Default |
| -------- | ---- | ------- |
| Project name | `--project-name <value>` | `my-airflow` |
| Web UI sign-on (native = Airflow user database, entra-id = Microsoft Entra ID OAuth) | `--sso <native\|entra-id>` | `native` |
| Infrastructure-as-Code (Terraform, AWS ECS Fargate + ECS executor) | `--iac <none\|aws-ecs>` | `none` |

## What it is for

- A team orchestrating scheduled data pipelines (DAGs) with a clear, lint-enforced structure
- Enterprise sign-on via Microsoft Entra ID OAuth (or Airflow's native auth) for the web UI
- Bursty, heavy tasks that need their own container via the hybrid AWS ECS executor, without a full Kubernetes cluster

## Deploying to the cloud

This stack ships an infrastructure-as-code target: **aws-ecs**.
Enable it at scaffold time with `--iac aws-ecs`, then use the `dude iac`
command group inside the generated project. The full deploy guide is part of
the project's own documentation — run `dude docs` after scaffolding.

## Conventions it enforces

`dude lint` runs **10 structural checks** for this stack, grouped by
area. Each one ships a prose rule file in the generated project under
`.claude/rules/`, so both you and a coding agent can see why a check exists
and how to fix a violation.

| Group | Checks |
| ----- | ------ |
| `AF` | 10 |

## Documentation inside the project

Every scaffolded project gets its own documentation site, served with
`dude docs`. This stack ships:

| Page | Title | Included |
| ---- | ----- | -------- |
| `index.md` | Home | always |
| `dude.md` | Working with dude | always |
| `project.md` | Project guide | always |
| `sso.md` | Sign-on (SSO) | always |
| `deploy.md` | Deploy (AWS ECS) | when `withIac` |
| `api.md` | Command reference | always |
| `cheatsheet.md` | Cheatsheet | always |
| `mkdocs.md` | Writing docs | always |

## Versions

- **Package:** [`@cubocicloide/stack-airflow`](https://www.npmjs.com/package/@cubocicloide/stack-airflow)
- **Requires dude:** `>= 0.1.0`

Both the CLI and the stack are pinned per project, so different projects can
sit on different versions. See [How it works](../concepts.md).
