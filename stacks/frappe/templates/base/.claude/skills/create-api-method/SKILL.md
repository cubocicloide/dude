---
name: create-api-method
description: Add a whitelisted HTTP endpoint to a custom Frappe app — a @frappe.whitelist() function in api.py, callable at /api/method/<app>.api.<name>, optionally paired with a server-rendered portal page. Surveys api.py for reuse, decides authenticated vs guest deliberately, and verifies with dude lint (PY001/PY002) and dude test.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *)"
---

# Create API Method

Guided creation of a whitelisted method — Frappe's RPC endpoint. Any function
decorated with `@frappe.whitelist()` in an installed app is **immediately**
reachable at `/api/method/<dotted.path>`; there is no router to register and no
review gate. That is convenient and it is also the risk, which is why PY001 and
PY002 exist.

The reference is `apps/ticketing/ticketing/api.py` (`ticket_stats`) and the
portal page that consumes it,
`apps/ticketing/ticketing/templates/pages/ticket_stats.{py,html}`.

> Read `.claude/rules/PY/001.md` and `PY/002.md` once at the start — they are
> the source of truth. `dude explain PY001` prints the same prose.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

Read the site host, which you'll need to call the endpoint:

```bash
grep SITE_NAME "$PROJECT_ROOT"/.env        # e.g. my-helpdesk.localhost → port 8000
```

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **Target app** — default `ticketing`. Must have a `pyproject.toml` under
   `apps/<app>/` (that is what makes it a real bench app — APP001).
2. **What the endpoint does** — and whether it **reads** or **writes**.
3. **Parameters** — name and type of each; they arrive as query string or JSON
   body keys, so they are strings unless you coerce them.
4. **Return shape** — a dict/list is serialised to JSON automatically.
5. **Who may call it** — an authenticated user (the default and almost always
   the right answer), or genuinely anonymous visitors. Do not assume guest.
6. **A portal page too?** — if the user wants a human-readable page as well as
   JSON, say so now; Step 5 adds the pair.

---

## Step 2 — Survey the existing API (reuse before create)

```bash
cat "$PROJECT_ROOT"/apps/<app>/<app>/api.py
grep -rn "frappe.whitelist" "$PROJECT_ROOT"/apps/<app>/
ls "$PROJECT_ROOT"/apps/<app>/<app>/templates/pages/ 2>/dev/null
```

- **An existing method already returns this data?** Call it rather than
  duplicating the query — `templates/pages/ticket_stats.py` does exactly that,
  importing `ticket_stats` instead of re-writing the aggregation.
- **A DocType controller already owns this logic?** Keep business rules in the
  controller's lifecycle hooks; the API method should be a thin, permission-
  respecting caller.
- Match the naming and docstring style already in `api.py`.

Report what you found and what you intend to reuse.

---

## Step 3 — Write the method

Add it to `apps/<app>/<app>/api.py` (tab-indented, Frappe style):

```python
@frappe.whitelist()
def ticket_stats() -> dict:
	"""Return HD Ticket counts grouped by status."""
	if not frappe.db.table_exists("HD Ticket"):
		return {"helpdesk_installed": False, "by_status": {}, "total": 0}

	rows = frappe.get_all(
		"HD Ticket",
		fields=["status", "count(name) as total"],
		group_by="status",
	)
	by_status = {row.status: row.total for row in rows}
	return {"helpdesk_installed": True, "by_status": by_status, "total": sum(by_status.values())}
```

Constraints to honour while writing:

- **Query through the ORM** — `frappe.get_all` / `frappe.get_list` /
  `frappe.get_doc` / `frappe.qb`. They apply the DocType permission model and
  escape everything. Raw `frappe.db.sql()` is a PY002 **warning**; raw SQL built
  with an f-string, `%`, `.format()` or concatenation is a PY002 **error**. If
  raw SQL is genuinely unavoidable, parameterise it:
  `frappe.db.sql("… where opening_date < %(cutoff)s", {"cutoff": cutoff})`.
- **Validate and coerce inputs.** Parameters arrive as strings from HTTP;
  `int(...)`/`frappe.parse_json(...)` them and `frappe.throw(_("…"))` on
  anything unexpected.
- **Tolerate absent apps.** A method touching another app's DocType should
  degrade rather than 500 — `frappe.db.table_exists(...)`, as above.
- **Writes need an explicit permission decision.** `ignore_permissions=True`
  turns a whitelisted method into a privilege escalation; only use it after
  checking `frappe.has_permission(...)` yourself, and say why in a comment.
- **Return the minimum.** The response is JSON to whoever is authenticated —
  don't leak fields the caller didn't ask for.

### Guest access — the deliberate decision

`allow_guest=True` makes the method callable by **unauthenticated visitors**.
PY001 flags every occurrence unless a justification comment sits on the same
line or the line directly above:

```python
# guest-ok: public status page, returns only aggregate counts
@frappe.whitelist(allow_guest=True)
def public_status() -> dict: ...
```

The comment is a claim you have to be able to defend. If you cannot write a
convincing reason, the answer is no `allow_guest` — callers authenticate with a
session cookie or an API key. Never expose a write or a delete to guests.

---

## Step 4 — Add a test

Put `test_api.py` beside `api.py`. `bench run-tests --app <app>` (wrapped by
`dude test`) discovers any `test_*.py` in the app. Use `FrappeTestCase` — it
wraps each test in a transaction and rolls it back, so tests never leak data
into the site. Mirror
`apps/ticketing/ticketing/ticketing/doctype/ticket_escalation_rule/test_ticket_escalation_rule.py`.

Import and call the function directly; cover the empty case, the happy path,
and every `frappe.throw` branch you added.

---

## Step 5 — Optional: the portal page

A server-rendered page is a **file pair** under
`apps/<app>/<app>/templates/pages/` — no registration anywhere. The route is
the filename: `ticket_stats.{py,html}` → `/ticket_stats`.

```python
# <route>.py
from <app>.api import <method>

def get_context(context):
	context.no_cache = 1
	context.stats = <method>()
	return context
```

```jinja
{# <route>.html #}
{% extends "templates/web.html" %}
{% block title %}…{% endblock %}
{% block page_content %}…{% endblock %}
```

The `.py` should **call the whitelisted method**, not re-implement its query —
that is the whole point of the shipped example. Set `context.no_cache = 1` for
anything dynamic. If the page 404s, the website cache is stale:
`dude site clear-cache`.

PY002 applies to the context code too — no interpolated SQL there either.

---

## Step 6 — Validate

```bash
cd "$PROJECT_ROOT"
dude lint                    # PY001/PY002 must pass
dude lint --format json      # machine-readable: file, line, code
dude explain PY001           # (or PY002) — why, and how to satisfy it
dude format                  # ruff format + autofix over apps/
dude test --app <app>
```

`dude lint` is a pure filesystem check — it needs no Docker and no running
bench, so run it first and fix the cause each diagnostic names. Never work
around a diagnostic.

Then call the endpoint for real (the bench must be up — `dude up`; first boot
provisions the site and takes several minutes):

```bash
# From the host — SITE_NAME comes from .env, the bench serves it on port 8000
curl -s "http://$SITE_NAME:8000/api/method/<app>.api.<method>"
# Unauthenticated: expect a PermissionError unless the method is guest-ok.

# Without HTTP, straight through the framework
dude bench --site all execute <app>.api.<method>

# Portal page, if you added one
open "http://$SITE_NAME:8000/<route>"
```

---

## Step 7 — Report

```
API method created
═════════════════════════════════════════
Method      apps/<app>/<app>/api.py :: <method>
Endpoint    /api/method/<app>.api.<method>
Access      authenticated | guest-ok: <reason>
Params      <name: type, …>
Returns     <shape>
Portal page <apps/<app>/<app>/templates/pages/<route>.{py,html} | n/a>
Test        apps/<app>/<app>/test_api.py
─────────────────────────────────────────
dude lint:             ✓  (PY001, PY002)
dude test --app <app>: ✓
Called:                dude bench --site all execute <app>.api.<method>
```
