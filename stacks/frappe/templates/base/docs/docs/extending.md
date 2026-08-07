# Extending the app

Recipes for the things you will actually do, in the order you will probably do
them. Each recipe follows the patterns already present in `apps/ticketing/` —
copy from the example, don't start from a blank file — and ends with the
`dude lint` rules that check your work (prose descriptions live in
`.claude/rules/{APP,DT,PY}/`).

The universal inner loop:

```bash
dude site migrate    # sync schema + fixtures after model/fixture changes
dude lint            # structural checks over apps/
dude test --app <app>
```

---

## Add a DocType

Two equivalent paths — same result: a JSON schema committed inside your app.

=== "Via the Desk UI (recommended)"

    The site runs with `developer_mode = 1`, so DocTypes created in Desk are
    **written back into the app's source tree**:

    1. Open <code>/app/doctype/new</code> in Desk.
    2. Set the **Module** to one of your app's modules (e.g. `Ticketing` —
       modules are listed in `apps/<app>/<app>/modules.txt`). The module
       determines *which app on disk* receives the files.
    3. Add fields, tick the permission roles, save.
    4. The full bundle appears under
       `apps/<app>/<app>/<module>/doctype/<snake_case_name>/` — JSON, a stub
       controller, `__init__.py`. Add a `test_<name>.py` (copy the escalation
       rule's) and commit everything.

=== "By hand (copy the example)"

    1. Copy `apps/ticketing/ticketing/ticketing/doctype/ticket_escalation_rule/`
       to a sibling directory named after your DocType (snake_case).
    2. Rename the files inside to match, then edit the JSON: `name`, `module`,
       `autoname`, the `fields` array (snake_case `fieldname`s), and the
       `permissions` array (never leave it empty).
    3. Rename the controller class to the CamelCase DocType name.
    4. Update the test file.
    5. Apply it: `dude site migrate` (creates the table).

Either way, finish with:

```bash
dude site migrate
dude lint
dude test --app <app>
```

!!! tip "Guided version"
    The project ships a Claude skill for this: `/create-doctype` walks through
    the manual path interactively.

**Lint rules**: DT001 (complete bundle: JSON + controller + tests together),
DT002 (permissions declared), DT003 (module registered in `modules.txt`),
DT004 (snake_case fieldnames), PY003 (tests present).

---

## Add a scheduled task

1. Write a plain, **idempotent** function in `apps/<app>/<app>/tasks.py` —
   `apps/ticketing/ticketing/tasks.py` shows the shape, including the
   "did I already do this?" guard.
2. Register it in `hooks.py` under `scheduler_events`, keyed by frequency
   (`all`, `hourly`, `daily`, `weekly`, `monthly`, or `cron`):

    ```python
    scheduler_events = {
        "hourly": ["ticketing.tasks.escalate_overdue_tickets"],
    }
    ```

3. Restart (`dude up`) so the scheduler process picks up the new hook.
4. Don't wait an hour to test it — run it right now:

    ```bash
    dude bench --site all execute ticketing.tasks.escalate_overdue_tickets
    ```

**Lint rules**: APP002 (every dotted path declared in `hooks.py` must resolve
to a real function).

---

## Hook another app's DocType (doc_events)

To run your code when *someone else's* documents change — the way `ticketing`
extends `HD Ticket` without forking Helpdesk:

1. Write handlers as plain functions taking `(doc, method)` in a dedicated
   module — see `apps/ticketing/ticketing/events/hd_ticket.py`.
2. Declare them in `hooks.py` under `doc_events`:

    ```python
    doc_events = {
        "HD Ticket": {
            "after_insert": "ticketing.events.hd_ticket.after_insert",
            "on_update": "ticketing.events.hd_ticket.on_update",
        },
    }
    ```

3. Restart (`dude up`). Available events include `validate`, `before_save`,
   `after_insert`, `on_update`, `on_submit`, `on_trash`, ….

Hooks on a DocType that isn't installed are harmless — the handlers simply
never fire (which is why the example app also works without Helpdesk).
Detect field changes with `doc.get_doc_before_save()`, as `on_update` does.

**Lint rules**: APP003 (`doc_events` handler dotted paths must resolve).

---

## Add a workflow

Workflows are **records, not code**, so the loop is: build in the UI, export
as a fixture, declare in `hooks.py`.

1. In Desk, create the Workflow (search "Workflow"): pick the DocType, define
   the states, and the role-restricted transitions between them.
2. Declare it (and its linked masters — order matters) in `hooks.py`:

    ```python
    fixtures = [
        {"dt": "Workflow State", "filters": [["name", "in", ["Draft", "Approved", "Rejected"]]]},
        {"dt": "Workflow Action Master", "filters": [["name", "in", ["Approve", "Reject"]]]},
        {"dt": "Workflow", "filters": [["name", "in", ["My Workflow"]]]},
    ]
    ```

3. Export the records into the app:

    ```bash
    dude bench --site all export-fixtures --app <app>
    ```

    JSON files land in `apps/<app>/<app>/fixtures/` — commit them. From now
    on every `dude site migrate` re-imports them, so the workflow exists on
    every environment.

`apps/ticketing/ticketing/fixtures/workflow.json` is the shipped example
(Draft → Approved/Rejected on `Ticket Escalation Rule`).

!!! warning "Filters are not optional"
    Always filter fixtures to *your* records (as above). `{"dt": "Workflow"}`
    with no filters would export every workflow on the site — including other
    apps' — into your app.

**Lint rules**: APP004 (fixtures declared in `hooks.py` ↔ JSON files shipped
in `fixtures/` stay in sync).

---

## Add a portal page

A server-rendered public web page:

1. Create the pair under `apps/<app>/<app>/templates/pages/`:
   `<route>.html` (Jinja template) and `<route>.py` with a
   `get_context(context)` function. The route is the filename:
   `ticket_stats.*` → `/ticket_stats`.
2. Put data on `context` in `get_context` — it becomes available to the
   template. Set `context.no_cache = 1` for dynamic pages.
3. No registration needed. If the page doesn't show up, clear the website
   cache: `dude site clear-cache`.

Example: `apps/ticketing/ticketing/templates/pages/ticket_stats.{py,html}` —
note how the `.py` reuses the whitelisted API function rather than duplicating
the query.

**Lint rules**: PY002 (no string-interpolated SQL — use `frappe.get_all` /
parameterised queries in your context code).

---

## Add an API endpoint

1. Add a function to `apps/<app>/<app>/api.py` and decorate it:

    ```python
    @frappe.whitelist()
    def my_endpoint() -> dict:
        ...
    ```

2. It is immediately callable at `/api/method/<app>.api.my_endpoint`
   (authenticated by session cookie or API token).
3. Query through the ORM (`frappe.get_all`, `frappe.get_doc`) so DocType
   permissions are respected; take parameters as keyword arguments.

Do **not** add `allow_guest=True` unless the data is genuinely public — every
guest-exposed method is an unauthenticated door into your site.

Example: `apps/ticketing/ticketing/api.py` (`ticket_stats`), consumed by both
the portal page and HTTP clients.

**Lint rules**: PY001 (guest-exposed whitelisted methods are flagged), PY002
(no raw/interpolated SQL).

---

## Create a whole new app

When a feature doesn't belong in `ticketing`, give it its own app:

```bash
dude app new --name my_app        # bench new-app, relocated into apps/my_app
dude app install --name my_app    # install it on the site
dude up                           # restart so init.sh links everything
```

The new app lives in `apps/my_app/` in this repo, symlinked into the bench in
editable mode — exactly like `ticketing`. From here, every recipe above
applies; keep its `hooks.py` declarative and give each DocType the full
bundle.

**Lint rules**: APP001 (canonical app layout: `pyproject.toml`,
`<app>/hooks.py`, `<app>/modules.txt`, …) — and everything else on this page
as the app grows.

---

## Verify everything

```bash
dude lint      # all APP/DT/PY structural checks; exit 1 on errors
dude review    # lint + ruff check in one pass
dude test      # the ticketing app's tests (use --app for others)
dude format    # ruff format + autofix (Frappe style — tabs)
```
