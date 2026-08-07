---
name: create
description: Guided scaffolding for this stack. Asks whether you want to create an Airflow DAG or wire a connection/variable, then runs the matching convention-aware flow (create-dag or create-connection) that inspects the existing pipelines and enforces the stack's AF rules.
disable-model-invocation: false
allowed-tools: "Read Glob Grep Bash(find *) Bash(cat *)"
---

# Create (router)

Single entry point for adding things to this Airflow project. It figures out
**what** you want to build, then hands off to the specialised skill that knows
the exact conventions (see `.claude/rules/AF/`) and inspects the existing
`airflow/dags/` tree before writing anything.

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report _"No dude.json found — are you inside a dude project?"_ and stop.
Set `PROJECT_ROOT` to the directory containing `dude.json`.

## Step 1 — Ask what to create

If the user has not already made it explicit, ask:

> **What do you want to create?**
> 1. **DAG** — a new pipeline (`airflow/dags/<area>/<dag_id>.py`, plus any shared helper in `lib/`)
> 2. **Connection / Variable** — wire an external system or a runtime value into the deployment

Map free-form answers too: "pipeline", "workflow", "job", "schedule something"
→ DAG; "credentials", "secret", "conn_id", "database access", "API key",
"env var for a DAG" → connection/variable.

## Step 2 — Hand off

- **DAG** → read `.claude/skills/create-dag/SKILL.md` and follow it from Step 0.
- **Connection / Variable** → read `.claude/skills/create-connection/SKILL.md`
  and follow it from Step 0.

Pass along anything the user already specified (dag_id, schedule, tags,
conn_id, whether the value is secret) so the worker skill can skip questions it
already has answers for.

## Notes

- This router never writes files itself — it only routes.
- Both worker skills are also invocable directly (`/create-dag`,
  `/create-connection`) when you already know which one you need.
- A new DAG that needs a credential is both: run `/create-dag` first, then
  `/create-connection` for the wiring.
- Other recurring additions are not routed here because they are single edits,
  not workflows: a **plugin** is a package under `airflow/plugins/<name>/`
  registering an `AirflowPlugin` subclass (AF008 — copy `ops_toolkit/`), and a
  **Python dependency** is a pinned line in `airflow/requirements.txt` (AF009)
  followed by `dude up --build`.
