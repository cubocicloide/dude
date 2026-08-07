---
name: create
description: Guided scaffolding for this stack. Asks whether you want to create a DocType, a hook (scheduled job / document event / fixture) or a whitelisted API method, then runs the matching convention-aware flow that inspects the existing app and enforces the stack's APP/DT/PY rules.
disable-model-invocation: false
allowed-tools: "Read Glob Grep Bash(find *) Bash(cat *) Bash(ls *)"
---

# Create (router)

Single entry point for adding something to a custom Frappe app in this project.
It figures out **what** you want to build, then hands off to the specialised
skill that knows the exact conventions (see `.claude/rules/{APP,DT,PY}/`) and
inspects the existing app before writing anything.

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report _"No dude.json found — are you inside a dude project?"_ and stop.
Set `PROJECT_ROOT` to the directory containing `dude.json`.

The apps you can add to are the directories under `apps/` that ship a
`pyproject.toml` (that is what makes one a real bench app — APP001):

```bash
ls -d "$PROJECT_ROOT"/apps/*/pyproject.toml
```

## Step 1 — Ask what to create

If the user has not already made it explicit, ask:

> **What do you want to create?**
> 1. **DocType** — a new model: JSON schema + controller + tests, in a module of a custom app
> 2. **Hook** — a scheduled background job, a handler for another app's document events, or a shipped fixture
> 3. **API method** — a `@frappe.whitelist()` endpoint at `/api/method/…`, optionally with a portal page

Map free-form answers too:

| The user says | Route to |
|---------------|----------|
| "model", "table", "doctype", "new record type", "form" | **DocType** |
| "cron", "scheduled", "background job", "every hour", "task" | **Hook** (scheduled job) |
| "when a ticket is saved", "on save", "doc_events", "react to", "extend HD Ticket" | **Hook** (document event) |
| "workflow", "fixture", "ship these records", "seed data" | **Hook** (fixture) |
| "endpoint", "API", "whitelist", "REST", "call it over HTTP" | **API method** |
| "portal page", "public page", "web page" | **API method** (its Step 5 covers the page pair) |

## Step 2 — Hand off

- **DocType**    → read `.claude/skills/create-doctype/SKILL.md` and follow it from Step 1.
- **Hook**       → read `.claude/skills/create-hook/SKILL.md` and follow it from Step 0.
- **API method** → read `.claude/skills/create-api-method/SKILL.md` and follow it from Step 0.

Pass along anything the user already specified (target app, DocType name,
frequency, endpoint name) so the worker skill can skip questions it already has
answers for.

## Not a skill: a whole new app

If the feature doesn't belong in any existing app, it needs its own — two
commands, no skill required:

```bash
dude app new --name my_app        # bench new-app, relocated into apps/my_app
dude app install --name my_app    # install it on the site
dude up                           # restart so docker/init.sh links everything
```

The new app lands in `apps/my_app/`, symlinked into the bench in editable mode
exactly like `ticketing`. From there every skill above applies to it — pass
`my_app` as the target app. `dude lint` will hold the new app to APP001 (it
needs `pyproject.toml`, and `my_app/hooks.py`, `modules.txt`, `patches.txt`,
`__init__.py`).

## Notes

- This router never writes files itself — it only routes.
- All three worker skills are also invocable directly (`/create-doctype`,
  `/create-hook`, `/create-api-method`) when you already know which one you need.
- Every worker skill ends by running `dude lint` (plus `dude lint --format json`
  and `dude explain <CODE>` when something trips). That is the point: this
  project's conventions are checked mechanically, so the skill verifies its own
  output rather than asserting it.
- `apps/ticketing/README.md` maps every Frappe building block to a concrete
  file, and `docs/docs/extending.md` is the prose version of these recipes.
