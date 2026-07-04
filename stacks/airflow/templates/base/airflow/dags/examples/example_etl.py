"""### example_etl — the reference pipeline

A minimal extract → transform → load DAG showing every project convention:

* **TaskFlow API** (`@dag` / `@task`) with data passed between tasks via XCom
* explicit `schedule=` / `catchup=` / `tags=` (lint rules AF002–AF004)
* shared policy via `default_args=DEFAULT_ARGS` (AF005)
* heavy work isolated in task functions — module scope stays import-cheap

Use this file as the template for new pipelines.
"""

import pendulum
from airflow.sdk import dag, task

from lib.defaults import DEFAULT_ARGS


@dag(
    dag_id="example_etl",
    description="Reference ETL pipeline (TaskFlow API).",
    schedule="@daily",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    tags=["examples", "etl"],
    default_args=DEFAULT_ARGS,
    doc_md=__doc__,
)
def example_etl():
    @task
    def extract() -> list[dict]:
        """Pretend to pull rows from a source system."""
        return [
            {"customer": "acme", "amount": 120},
            {"customer": "globex", "amount": 340},
            {"customer": "initech", "amount": 75},
        ]

    @task
    def transform(rows: list[dict]) -> dict:
        """Aggregate — import heavy libs (pandas, …) HERE, not at module scope (AF007)."""
        total = sum(r["amount"] for r in rows)
        return {"rows": len(rows), "total": total}

    @task
    def load(summary: dict) -> None:
        """Pretend to write the aggregate to a destination."""
        print(f"loaded {summary['rows']} rows, total={summary['total']}")

    load(transform(extract()))


example_etl()
