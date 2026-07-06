"""DAG-run lifecycle listeners — fleet-wide, zero changes to individual DAGs.

Airflow calls these hooks for EVERY dag run in the deployment; the plugin
registers this module. Each event becomes one structured JSON log line on the
scheduler — the single place to fan out to Slack/Teams/PagerDuty or to push
metrics (import your HTTP client inside the function body).
"""

import json
import logging

from airflow.listeners import hookimpl

log = logging.getLogger(__name__)


def _emit(event: str, dag_run, msg: str | None = None) -> None:
    payload = {
        "event": event,
        "dag_id": getattr(dag_run, "dag_id", None),
        "run_id": getattr(dag_run, "run_id", None),
        "state": str(getattr(dag_run, "state", None)),
        "msg": msg,
    }
    log.info("OPS_TOOLKIT %s", json.dumps(payload))


@hookimpl
def on_dag_run_success(dag_run, msg: str):
    _emit("dag_run_success", dag_run, msg)


@hookimpl
def on_dag_run_failed(dag_run, msg: str):
    # The natural place for a Slack webhook / incident hook.
    _emit("dag_run_failed", dag_run, msg)
