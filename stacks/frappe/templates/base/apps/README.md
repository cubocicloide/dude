# apps/ — your custom Frappe apps

Every directory in here that looks like a Frappe app (has a `pyproject.toml`
and a `<app>/hooks.py`) is automatically linked into the bench container in
**editable mode** on boot (see `docker/init.sh`): code changes on the host
reload live inside the container.

The scaffold ships one example app, **`ticketing/`**, that demonstrates each
core Frappe building block:

| Building block            | Where to look                                                        |
| ------------------------- | -------------------------------------------------------------------- |
| DocType (model)           | `ticketing/ticketing/doctype/ticket_escalation_rule/*.json`          |
| Controller (server logic) | `ticketing/ticketing/doctype/ticket_escalation_rule/*.py`            |
| Form script (desk view)   | `ticketing/ticketing/doctype/ticket_escalation_rule/*.js`            |
| Whitelisted API method    | `ticketing/ticketing/api.py`                                         |
| Scheduled tasks           | `ticketing/ticketing/tasks.py` + `scheduler_events` in `hooks.py`    |
| Document event hooks      | `ticketing/ticketing/events/hd_ticket.py` + `doc_events` in `hooks.py` |
| Workflow (flow)           | `ticketing/ticketing/fixtures/workflow.json`                         |
| Portal web page (view)    | `ticketing/ticketing/templates/pages/ticket_stats.*`                 |
| Tests                     | `ticketing/ticketing/doctype/ticket_escalation_rule/test_*.py`       |

To add a new app: `dude app new --name my_app` (wraps `bench new-app` and
moves the result here), then restart with `dude up`.
