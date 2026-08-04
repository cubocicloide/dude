<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/frappe.md -->

# `frappe`

A Frappe Framework ticketing system (Frappe Helpdesk) with a worked custom-app example and optional AWS ECS Fargate IaC.

**Built with:** `Frappe Framework` · `Frappe Helpdesk` · `MariaDB`

---

## Scaffold it

```bash
dude init my-app --stack frappe
```

The questions `dude init` asks for this stack — pass the matching flag to
answer it non-interactively. Flag names ignore case and dashes, so
`--celery-beat`, `--celeryBeat` and `--celerybeat` are the same flag.

| Question | Flag | Default |
| -------- | ---- | ------- |
| Project name | `--project-name <value>` | `my-helpdesk` |
| Install Frappe Helpdesk (the ticketing UI)? | `--helpdesk` | `true` |
| Infrastructure-as-Code (Terraform, AWS ECS Fargate) | `--iac <none\|aws-ecs>` | `none` |

## What it is for

- A ticketing/helpdesk system running Frappe Helpdesk out of the box
- A team learning Frappe's core building blocks via a worked custom-app example
- A DocType/workflow-driven backend with a straightforward path to AWS ECS Fargate

## Deploying to the cloud

This stack ships an infrastructure-as-code target: **aws-ecs**.
Enable it at scaffold time with `--iac aws-ecs`, then use the `dude iac`
command group inside the generated project. The full deploy guide is part of
the project's own documentation — run `dude docs` after scaffolding.

## Conventions it enforces

`dude lint` runs **11 structural checks** for this stack, grouped by
area. Each one ships a prose rule file in the generated project under
`.claude/rules/`, so both you and a coding agent can see why a check exists
and how to fix a violation.

| Group | Checks |
| ----- | ------ |
| `APP` | 4 |
| `DT` | 4 |
| `PY` | 3 |

## Documentation inside the project

Every scaffolded project gets its own documentation site, served with
`dude docs`. This stack ships:

| Page | Title | Included |
| ---- | ----- | -------- |
| `index.md` | Home | always |
| `frappe.md` | Frappe core concepts | always |
| `extending.md` | Extending the app | always |
| `dude.md` | Working with dude | always |
| `api.md` | Command reference | always |
| `mkdocs.md` | Writing docs | always |
| `deploy.md` | Deploy (AWS ECS) | when `withIac` |

## Versions

- **Package:** [`@cubocicloide/stack-frappe`](https://www.npmjs.com/package/@cubocicloide/stack-frappe)
- **Requires dude:** `>= 0.1.0`

Both the CLI and the stack are pinned per project, so different projects can
sit on different versions. See [How it works](../concepts.md).
