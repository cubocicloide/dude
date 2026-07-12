---
'@cubocicloide/stack-frappe': minor
'@cubocicloide/dude': patch
---

New stack: **frappe** — a Frappe Framework + Frappe Helpdesk ticketing system
that doubles as a worked example of Frappe's core building blocks.

- **Scaffold** — dockerised dev bench (MariaDB, redis-cache/redis-queue,
  `frappe/bench` container self-provisioned by `docker/init.sh`), the site,
  optional Frappe Helpdesk install, and a custom app `apps/ticketing`
  demonstrating DocTypes (model + controller + form script + tests),
  whitelisted API methods, scheduled tasks, doc_events on `HD Ticket`,
  an approval Workflow shipped as fixtures, and a portal page.
- **Commands** — `up/down/logs/shell`, `bench` (raw passthrough),
  `site migrate/console/backup/clear-cache/mariadb`, `app new/install`,
  `test`, `format` (ruff, Frappe style), `review`, `docs`, `lint`.
- **Lint rules** — 11 Frappe best-practice checks (APP001–004 app layout and
  hooks integrity, DT001–004 DocType conventions, PY001–003 Python safety),
  each mirrored by a prose rule in the generated project's `.claude/rules/`.
- **IaC** — `--iac aws-ecs`: Terraform for AWS ECS Fargate (ALB, RDS MariaDB,
  ElastiCache Redis, EFS sites volume; frontend/backend/websocket/worker/
  scheduler services from a single frappe_docker-style image) plus the full
  `dude iac …` command group including `create-site` and `migrate`.

`@cubocicloide/dude`: register the `frappe` stack in `registry.json`.
