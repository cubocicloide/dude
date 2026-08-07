---
name: create-hook
description: Wire a new hook into a custom Frappe app — a scheduled background job (scheduler_events + tasks.py), a document event handler on another app's DocType (doc_events + events/), or a shipped fixture. Surveys the existing hooks.py before adding, writes the handler in the right module, registers the dotted path, and verifies with dude lint (APP002/APP003/APP004) and dude test.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *)"
---

# Create Hook

`hooks.py` is the app's contract with the framework. Every entry in it is a
**dotted path resolved at runtime** — a typo does not fail on install or on
boot, the job simply never runs. That is why APP002, APP003 and APP004 exist,
and why this skill always ends by running the linter.

The reference app is `apps/ticketing/` — copy its patterns, don't invent new
ones. Keep `hooks.py` declarative: the logic lives in `tasks.py`, `events/` or
`fixtures/`, never inline in the hooks dict.

> Read `.claude/rules/APP/002.md`, `003.md` and `004.md` once at the start —
> they are the source of truth. `dude explain APP002` prints the same prose.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

Confirm which apps are real bench apps (a directory under `apps/` is only an
app if it has a `pyproject.toml` — that is exactly what the linter checks, see
APP001):

```bash
ls -d "$PROJECT_ROOT"/apps/*/pyproject.toml
```

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **Target app** — default `ticketing`. Must be one of the apps found above.
2. **Which kind of hook**:
   - **Scheduled job** — "run this every hour/day" → `scheduler_events` (APP002)
   - **Document event** — "when an HD Ticket is saved, do X" → `doc_events` (APP003)
   - **Fixture** — "ship this Workflow / these records with the app" → `fixtures` (APP004)
3. **The specifics**:
   - scheduled job → the frequency (`all`, `hourly`, `daily`, `weekly`,
     `monthly`, or a `cron` expression) and what the job does
   - document event → the DocType (e.g. `HD Ticket`) and the event
     (`validate`, `before_save`, `after_insert`, `on_update`, `on_submit`,
     `on_trash`, …)
   - fixture → the DocType whose records to ship, and which records

---

## Step 2 — Survey the existing hooks (extend before adding)

Read the whole file before touching it — the answer is often "add one line to a
list that already exists":

```bash
cat "$PROJECT_ROOT"/apps/<app>/<app>/hooks.py
ls   "$PROJECT_ROOT"/apps/<app>/<app>/tasks.py "$PROJECT_ROOT"/apps/<app>/<app>/events/ 2>/dev/null
ls   "$PROJECT_ROOT"/apps/<app>/<app>/fixtures/ 2>/dev/null
```

- **Same frequency already declared?** Append to that list, don't add a second
  key for the same frequency.
- **Same DocType already hooked?** Add the event to its existing dict entry.
- **A module already covers this area?** `tasks.py` for jobs,
  `events/<scrubbed_doctype>.py` for document events — put the function there
  instead of creating a parallel module.

Report what you found and what you intend to extend.

---

## Step 3 — Write the handler

### A. Scheduled job → `apps/<app>/<app>/tasks.py`

A plain module-level function, no arguments. Model it on
`escalate_overdue_tickets` in `apps/ticketing/ticketing/tasks.py`.

```python
def close_stale_resolved_tickets() -> None:
	"""Daily: close tickets that have sat in Resolved for more than 7 days."""
	if not frappe.db.table_exists("HD Ticket"):
		return
	...
```

Non-negotiables:
- **Idempotent.** The scheduler guarantees at-least-once, not exactly-once.
  Guard with a "did I already do this?" check — the shipped example looks for
  its own marker comment before escalating again.
- **Defensive about other apps.** A job that touches a DocType from another app
  must tolerate that app being absent (`frappe.db.table_exists(...)`), the way
  both shipped jobs do — the example app works with or without Helpdesk.
- **ORM, not SQL.** `frappe.get_all` / `frappe.get_doc` / `frappe.qb`. An
  f-string inside `frappe.db.sql()` is a PY002 **error**.
- `frappe.db.commit()` at the end when the job wrote something.

### B. Document event → `apps/<app>/<app>/events/<scrubbed_doctype>.py`

One module per hooked DocType, named after the scrubbed DocType
(`HD Ticket` → `hd_ticket.py`). Handlers are plain functions taking
`(doc, method=None)`. Model them on
`apps/ticketing/ticketing/events/hd_ticket.py`.

```python
def on_update(doc, method=None) -> None:
	before = doc.get_doc_before_save()
	if before is None or before.status == doc.status:
		return
	...
```

Notes:
- `doc.get_doc_before_save()` is the standard way to detect a field change
  inside the same save cycle.
- New module? Create the `events/` package with an `__init__.py` if it doesn't
  exist yet — the dotted path must import.
- Handlers run on **every save** of that DocType. Keep them cheap and never let
  one raise for an unrelated reason.

### C. Fixture → `apps/<app>/<app>/fixtures/<scrubbed_dt>.json`

Fixtures are **records, not code**: build them in the Desk UI first, then
export. Do not hand-write the JSON.

---

## Step 4 — Register the dotted path in `hooks.py`

This is the step the linter checks. The path is
`<app>.<module>.<function>` — relative to the app's python package, not the
repo root.

```python
# A — scheduler_events (APP002)
scheduler_events = {
	"hourly": ["ticketing.tasks.escalate_overdue_tickets"],
	"daily": ["ticketing.tasks.close_stale_resolved_tickets"],
}

# B — doc_events (APP003)
doc_events = {
	"HD Ticket": {
		"after_insert": "ticketing.events.hd_ticket.after_insert",
		"on_update": "ticketing.events.hd_ticket.on_update",
	},
}

# C — fixtures (APP004): linked masters first, and always filtered
fixtures = [
	{"dt": "Workflow State", "filters": [["name", "in", ["Draft", "Approved", "Rejected"]]]},
	{"dt": "Workflow Action Master", "filters": [["name", "in", ["Approve", "Reject"]]]},
	{"dt": "Workflow", "filters": [["name", "in", ["Ticket Escalation Rule Approval"]]]},
]
```

- `hooks.py` is **tab-indented** (Frappe style, enforced by `dude format`) —
  match the surrounding file.
- APP004 is checked in **both** directions: a declared fixture with no
  `fixtures/<scrubbed_name>.json` breaks a fresh install, and an undeclared
  JSON file is never imported by anyone. `Workflow State` → `workflow_state.json`.
- Never declare a fixture without `filters` — `{"dt": "Workflow"}` exports
  *every* workflow on the site, including other apps'.

For a fixture, export the records into the app now and commit the JSON:

```bash
dude bench --site all export-fixtures --app <app>
```

---

## Step 5 — Add a test

Not mechanically required for hooks (PY003 nudges DocType tests specifically),
but `bench run-tests --app <app>` discovers any `test_*.py` in the app, so it
costs one file. Put `test_tasks.py` beside `tasks.py`, or
`test_<scrubbed_doctype>.py` beside the event module, and use `FrappeTestCase`
— mirror
`apps/ticketing/ticketing/ticketing/doctype/ticket_escalation_rule/test_ticket_escalation_rule.py`.
It wraps each test in a transaction and rolls it back, so tests never leak data
into the site.

Test the handler function directly — do not try to make the scheduler fire.

---

## Step 6 — Load and validate

Hooks are cached and the scheduler process reads them at start, so a new hook
is not live until the bench picks it up:

```bash
cd "$PROJECT_ROOT"
dude site clear-cache               # drops the cached hooks
dude down && dude up                # restart so `schedule` re-reads scheduler_events
dude site migrate                   # ONLY for fixtures — re-imports fixtures/*.json
```

Then verify, in this order:

```bash
dude lint                           # APP002/APP003/APP004 must pass
dude lint --format json             # machine-readable: file, line, code
dude explain APP002                 # (or APP003 / APP004) — why, and how to fix
dude test --app <app>
```

`dude lint` is a pure filesystem check — it runs without Docker and will catch
an unresolvable dotted path or a fixture mismatch immediately. Fix the cause the
rule describes; never work around a diagnostic.

Finally, exercise the hook for real instead of waiting for the schedule:

```bash
# A — run the job now
dude bench --site all execute <app>.tasks.<function>

# B — trigger the document event by saving a document
dude site console        # then: frappe.get_doc("HD Ticket", "<name>").save()

# C — confirm the fixture landed
dude site console        # then: frappe.get_all("Workflow", pluck="name")
```

---

## Step 7 — Report

```
Hook created
═════════════════════════════════════════
Kind        <scheduled job | doc event | fixture>
App         <app>
Handler     apps/<app>/<app>/<module>.py :: <function>
Registered  hooks.py → <scheduler_events "<freq>" | doc_events "<DocType>.<event>" | fixtures>
Test        <test file | none>
─────────────────────────────────────────
dude lint:            ✓  (APP002/APP003/APP004)
dude test --app <app>: ✓
Exercised:            dude bench --site all execute <dotted.path>
```
