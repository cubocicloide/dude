---
name: create-doctype
description: Scaffold a new Frappe DocType in a custom app. Asks for the target app, DocType name, module, fields and role permissions, then creates the full bundle (JSON schema, controller, tests) by following the ticket_escalation_rule example, applies it with dude site migrate, and verifies with dude lint and dude test.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *)"
---

# Create DocType

Guided creation of a DocType that satisfies the DT/PY rules in
`.claude/rules/`. The reference bundle is
`apps/ticketing/ticketing/ticketing/doctype/ticket_escalation_rule/` — copy
its patterns, don't invent new ones.

> Read `.claude/rules/DT/*.md` and `.claude/rules/PY/003.md` once at the
> start — they are the source of truth.

**The UI alternative** — the site runs with `developer_mode = 1`, so a DocType
created in the Desk UI (`/app/doctype/new`) is written back into the app's
source tree automatically. Prefer the UI when the user wants to explore field
types interactively or the schema is large; use this skill's manual path when
working headless, from a spec, or when the Desk UI isn't running. Either way
the result is the same committed bundle — and the UI path still needs the test
file added by hand.

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **Target app** — default `ticketing`. Must exist under `apps/`.
2. **DocType name** — Title Case, singular (e.g. `Support Contract`). Derive
   `scrub_name` = lowercase with underscores (`support_contract`).
3. **Module** — must be listed in `apps/<app>/<app>/modules.txt` (check it;
   `ticketing` has one module: `Ticketing`). The module's scrubbed name is the
   directory the bundle lives under.
4. **Fields** — for each: `fieldname` (snake_case — DT004), `fieldtype`
   (`Data`, `Int`, `Select` + `options`, `Link` + `options`, `Check`,
   `Small Text`, `Date`, …), `label`, `reqd` yes/no.
5. **Permissions** — which roles get which rights (read/write/create/delete).
   At least one role — an empty `permissions` array violates DT002.
6. **Naming** — autoname by a unique field (`field:<fieldname>`), a series
   (`PREF-.####`), or default hash.

---

## Step 2 — Create the bundle

Create `apps/<app>/<app>/<scrub_module>/doctype/<scrub_name>/` with **all** of
these files (DT001), modelling each on the `ticket_escalation_rule` file of
the same role:

| File | Content |
|------|---------|
| `__init__.py` | empty |
| `<scrub_name>.json` | the schema — copy `ticket_escalation_rule.json`, replace `name`, `module`, `autoname`, `field_order`, `fields`, `permissions`; keep `"doctype": "DocType"`, engine, sort settings |
| `<scrub_name>.py` | controller: `class <CamelCaseName>(Document)` with a `validate(self)` stub enforcing any invariant the user described (`frappe.throw(_("…"))`) |
| `test_<scrub_name>.py` | `FrappeTestCase` subclass with at least one insert test and one validation-failure test (PY003) — mirror `test_ticket_escalation_rule.py` |

Checks while writing:

- Every `fieldname` snake_case (DT004); layout pseudo-fields
  (`column_break_*`, `*_section`) count too.
- `permissions` non-empty (DT002); grant only what the user asked for.
- `"module"` matches an entry in `modules.txt` (DT003).
- No raw SQL anywhere (PY002); query via `frappe.get_all`/`frappe.get_doc`.

---

## Step 3 — Apply + validate

```bash
dude site migrate       # creates the table from the new JSON
dude lint               # must pass — fix any DT/PY violation and re-run
dude test --app <app>   # the new tests must pass
```

If `dude site migrate` fails on the JSON, compare it field-by-field with
`ticket_escalation_rule.json` — missing framework keys are the usual cause.

---

## Step 4 — Report

```
DocType created
═════════════════════════════════════════
DocType     <Name>  (module <Module>, app <app>)
Bundle      apps/<app>/<app>/<scrub_module>/doctype/<scrub_name>/
Fields      <n> (+ naming: <autoname>)
Permissions <roles>
Tests       test_<scrub_name>.py
─────────────────────────────────────────
dude site migrate: ✓
dude lint:         ✓
dude test:         ✓
Open it: /app/<scrub_name with hyphens>
```
