---
name: create-dag
description: Scaffold a new Airflow DAG. Asks for the dag_id, schedule, tags and the steps it performs, surveys existing DAGs and airflow/dags/lib/ for reuse, then creates the one-DAG-per-file module following the AF rules, adds any shared helper, and verifies with dude format, dude lint and dude test.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *)"
---

# Create DAG

Guided creation of an Airflow DAG that satisfies every rule in
`.claude/rules/AF/`. The skill **inspects the existing DAGs first** so new
pipelines reuse the project's helpers, tags and patterns instead of
re-inventing them.

> Read `.claude/rules/AF/001.md`–`010.md` once at the start — they are the
> source of truth. `dude explain AF001` prints the same page from the CLI.
> The reference DAG is `airflow/dags/examples/example_etl.py`.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

Confirm the DAG tree is where the rules expect it:

```bash
ls "$PROJECT_ROOT"/airflow/dags
cat "$PROJECT_ROOT"/airflow/dags/.airflowignore
```

`airflow/dags/lib/` is excluded from DAG parsing by `.airflowignore` — it holds
shared code only and must never define a DAG.

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **`dag_id`** — snake_case, unique across the project. It also becomes the
   file name (AF001).
2. **Area** — the sub-directory under `airflow/dags/` this pipeline belongs to
   (e.g. `sales/`, `ingest/`). Use an existing one when it fits;
   `examples/` is reserved for the scaffold's reference DAGs.
3. **Schedule** — a cron expression, a preset (`@daily`, `@hourly`), a
   Timetable instance, or `None` for manual/triggered-only (AF002).
4. **Catch-up** — should unpausing back-fill every interval since
   `start_date`? Almost always `False` (AF003).
5. **Tags** — at least one, lowercase and stable: owning team, domain, and any
   grouping the UI should filter on (AF004).
6. **Steps** — what each task does, and the dependencies between them. Ask
   whether data flows between tasks (XCom) or each step is standalone.
7. **External systems** — any connection, variable or env var the tasks need
   (this drives Step 5's parse-time hygiene and possibly `/create-connection`).

---

## Step 2 — Survey the existing code (reuse before create)

Run these and **read the relevant matches** before proposing anything:

```bash
find "$PROJECT_ROOT"/airflow/dags -name '*.py' -not -path '*/lib/*'
ls "$PROJECT_ROOT"/airflow/dags/lib/
grep -rho 'tags=\[[^]]*\]' "$PROJECT_ROOT"/airflow/dags | sort -u
ls "$PROJECT_ROOT"/airflow/plugins/
```

- **Similar DAG** — find the closest existing pipeline (same area, same
  operator family) and mirror its structure, imports and docstring style.
- **Existing helper** — if `airflow/dags/lib/` already has the transform,
  client or callback you need, import it; only add a new module there when
  nothing fits. `lib/defaults.py` holds `DEFAULT_ARGS`, `lib/callbacks.py`
  holds `notify_failure`.
- **Existing tag vocabulary** — reuse the tags already in use rather than
  inventing a synonym (`etl` vs `ETL` vs `extract`).
- **Plugin extension points** — `airflow/plugins/ops_toolkit/` ships
  `WorkdayTimetable` (a Mon–Fri `schedule=`), the Jinja macros
  `ds_add_business_days` / `deploy_env`, and fleet-wide DAG-run listeners.
  Prefer these over a hand-rolled equivalent.

Report what you found and what you intend to reuse.

---

## Step 3 — Derive the file path (AF001)

The file name **is** the `dag_id`. One DAG per file, no exceptions.

| `dag_id` | File |
|----------|------|
| `daily_sales_rollup` | `airflow/dags/sales/daily_sales_rollup.py` |
| `ingest_crm_contacts` | `airflow/dags/ingest/ingest_crm_contacts.py` |

Sub-directories are free-form and purely organisational — Airflow discovers
DAGs recursively. Confirm the file does not already exist; if the pipeline is a
variant of an existing DAG, that is still a new file, never a second
`with DAG(...)` block in the old one.

---

## Step 4 — Plan the file set (confirm before writing)

Present the full list of files to **create** and **modify**, then wait for an OK.

| File | Rule | Purpose |
|------|------|---------|
| `airflow/dags/<area>/<dag_id>.py` | AF001–AF007 | the DAG — exactly one, `dag_id` = file stem |
| `airflow/dags/lib/<module>.py` | AF001 | new shared helper, only if nothing existing fits (never defines a DAG) |
| `airflow/requirements.txt` | AF009 | new Python dependency, **pinned** with `==` |
| `.env.example` | AF010 | any new env var the DAG reads, with a safe default or `CHANGE-ME` |
| `docker-compose.yml` | AF010 | only if the variable must reach the containers — add it to the `x-airflow-common` `environment:` block |

Skip rows that don't apply. A DAG that needs a new Airflow connection or
variable is `/create-connection`'s job — run that skill after this one rather
than improvising a mechanism here.

The DAG integrity suite (`airflow/tests/`) is **generic**: it asserts every DAG
imports, is tagged, has an owner and retries, and matches its filename. A new
DAG needs no new test file — but add one to `airflow/tests/` when the DAG has
non-trivial pure logic worth pinning down.

---

## Step 5 — Implement

Follow the existing patterns exactly. Reference shape (TaskFlow, the default
choice — mirror `example_etl.py`):

```python
"""### daily_sales_rollup — one-line purpose

What it reads, what it writes, and anything an on-call reader needs at 3am.
This docstring is rendered in the UI via doc_md=__doc__.
"""

import pendulum
from airflow.sdk import dag, task

from lib.defaults import DEFAULT_ARGS


@dag(
    dag_id="daily_sales_rollup",              # == file name              (AF001)
    description="Roll up yesterday's orders into the daily summary table.",
    schedule="@daily",                        # explicit                  (AF002)
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,                            # explicit                  (AF003)
    tags=["sales", "rollup"],                 # non-empty                 (AF004)
    default_args=DEFAULT_ARGS,                # shared policy             (AF005)
    doc_md=__doc__,
)
def daily_sales_rollup():
    @task
    def extract() -> list[dict]:
        ...

    @task
    def transform(rows: list[dict]) -> dict:
        import pandas as pd        # heavy import INSIDE the task         (AF007)
        ...

    @task
    def load(summary: dict) -> None:
        from airflow.sdk import Variable
        target = Variable.get("target_table")   # runtime lookup          (AF006)
        ...

    load(transform(extract()))


daily_sales_rollup()
```

Use the classic `with DAG(...)` form instead when the pipeline is built from
operators rather than Python callables — see `example_kubernetes_pod.py` and
`example_ecs_task.py`. The rules apply identically to both forms.

Constraints to honour while writing:

- **Exactly one** `dag_id="…"` in the file, equal to the file stem (AF001).
- `schedule=` is always passed; `schedule_interval=` was removed in Airflow 3
  and fails to import (AF002).
- `catchup=` is always passed (AF003); `tags=[…]` is never empty (AF004).
- `default_args=DEFAULT_ARGS` — extend with `{**DEFAULT_ARGS, "retries": 5}`,
  never fork the dict (AF005).
- Module scope is re-executed by the dag-processor every ~30s. No
  `Variable.get`, `BaseHook.get_connection` or
  `Connection.get_connection_from_secrets` at module scope **or** in the
  `with DAG(...)` body (AF006) — move them into the task callable, or template
  them (`{{ var.value.x }}`, `{{ conn.pg.host }}`). Plain `os.getenv` at module
  scope is fine: it hits no database.
- Heavy libraries (pandas, numpy, polars, pyarrow, torch, …) are imported
  inside the task that uses them (AF007). `airflow.providers.*` operator
  imports stay at the top — they are needed at parse time.
- A new dependency goes into `airflow/requirements.txt` pinned with `==`
  (AF009), then `dude up --build`.
- Every `os.getenv("X")` the DAG performs is documented in `.env.example`
  (AF010).
- Shared code goes in `airflow/dags/lib/` and is imported as `from lib.x import y`.

---

## Step 6 — Validate

```bash
cd "$PROJECT_ROOT"
dude format                  # ruff format + import sort
dude lint --format json      # AF rules — must report zero errors
dude test                    # DAG integrity suite (pytest inside the image)
```

For every code `dude lint` reports, run `dude explain <CODE>` (e.g.
`dude explain AF006`) and fix the cause — do not work around a diagnostic, and
do not add the code to `lint.disable` in `dude.json` to make it go away.

Then exercise the DAG for real. This needs the deployment running (`dude up`);
`dags/` is bind-mounted so the new file is picked up without a rebuild:

```bash
dude dag errors                        # live import errors — must be empty
dude dag list                          # the new dag_id must appear
dude dag test --id <dag_id>            # run it end-to-end, no scheduler
dude dag test --id <dag_id> --date 2026-01-15   # a specific logical date
```

`dude dag test` executes the real tasks. If any of them writes to a production
system, say so and get the user's go-ahead before running it.

---

## Step 7 — Report

```
DAG created
═════════════════════════════════════════
dag_id      <dag_id>
File        airflow/dags/<area>/<dag_id>.py
Schedule    <schedule>   catchup=<bool>
Tags        <tags>
Tasks       <task_id> → <task_id> → <task_id>
Helpers     <created lib/x.py | reused lib/y.py | n/a>
Deps        <pinned lines added to requirements.txt | n/a>
Env vars    <added to .env.example | n/a>
─────────────────────────────────────────
dude format:   ✓
dude lint:     ✓  (0 errors)
dude test:     ✓
dude dag test: ✓ / not run (deployment down)
Next: unpause it in the UI (http://localhost:8080) or `dude dag trigger --id <dag_id>`
```
