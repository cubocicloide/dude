# @cubocicloide/stack-frappe

Stack plugin that teaches the [`dude`](https://github.com/cubocicloide/dude) CLI
how to scaffold, run and lint a **Frappe Framework** project shipped as a
minimal-but-functional **ticketing system** (Frappe + [Frappe Helpdesk](https://github.com/frappe/helpdesk)).

The scaffold is designed as a *learning-by-example* starting point: it ships a
custom Frappe app (`apps/ticketing`) that demonstrates every core Frappe
building block — DocTypes (models), controllers, form scripts (views), portal
pages, whitelisted API methods, scheduled tasks, document-event hooks,
workflows and fixtures — so developers can copy the patterns to build their
own apps.

## What you get

- **Local dev environment** — Docker Compose with MariaDB, two Redis instances
  and a `frappe/bench` container that provisions the bench + site on first boot
  and installs Frappe Helpdesk and the custom `ticketing` app.
- **Custom app example** (`apps/ticketing`) — mounted into the bench in
  editable mode, so code changes reload live.
- **Commands** — `dude up/down/logs/shell`, `dude bench …` (raw bench
  passthrough), `dude site migrate/console/backup/clear-cache/mariadb`,
  `dude app new/install`, `dude test`, `dude format`, `dude lint`, `dude docs`,
  and (optionally) `dude iac …` for AWS ECS Fargate deployment via Terraform.
- **Lint rules** — Frappe best-practice structural checks over `apps/`
  (app layout, hooks integrity, DocType conventions, Python safety), each with
  a matching prose rule in the generated project's `.claude/rules/`.

## Usage

```bash
dude init my-helpdesk --stack frappe
cd my-helpdesk
dude up
```

See the generated project's `README.md` and `docs/` for the full guide.
