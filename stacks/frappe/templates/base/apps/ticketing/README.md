# ticketing — example custom Frappe app

This app extends Frappe Helpdesk with a minimal escalation feature, and doubles
as a **worked example of every core Frappe building block**. Read it top-down
to learn how a Frappe app is put together, then copy the patterns into your
own apps.

## Tour

- `ticketing/hooks.py` — the app's contract with the framework: document event
  hooks, scheduler events, fixtures. Start here.
- `ticketing/ticketing/doctype/ticket_escalation_rule/` — a complete DocType:
  - `ticket_escalation_rule.json` — the model (fields, permissions, naming)
  - `ticket_escalation_rule.py` — the controller (`validate` lifecycle hook)
  - `ticket_escalation_rule.js` — the desk form script (client-side view logic)
  - `test_ticket_escalation_rule.py` — unit tests (`dude test`)
- `ticketing/api.py` — whitelisted methods, callable at
  `/api/method/ticketing.api.ticket_stats`.
- `ticketing/tasks.py` — background jobs wired via `scheduler_events`.
- `ticketing/events/hd_ticket.py` — handlers for `doc_events` on Helpdesk's
  `HD Ticket` DocType (extend another app without forking it).
- `ticketing/fixtures/` — records shipped with the app (a Workflow that gates
  escalation rules behind an approval flow) and synced on `bench migrate`.
- `ticketing/templates/pages/ticket_stats.*` — a public portal page at
  `/ticket-stats` (Jinja template + Python context).

## Everyday commands

```bash
dude shell                 # shell into the bench container
dude bench --site all migrate
dude site console          # IPython with the site loaded
dude test                  # run this app's tests
dude lint                  # Frappe best-practice structural checks
```
