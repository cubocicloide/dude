"""Task/DAG lifecycle callbacks shared by every pipeline.

`notify_failure` emits one structured JSON line per failed task — ship it to
Slack/Teams/PagerDuty by replacing the log call with your webhook of choice
(import any HTTP client *inside* the function: callbacks run at task runtime).
"""

import json
import logging

log = logging.getLogger(__name__)


def notify_failure(context) -> None:
    """on_failure_callback — wired into DEFAULT_ARGS for every DAG."""
    ti = context.get("task_instance")
    payload = {
        "event": "task_failed",
        "dag_id": getattr(ti, "dag_id", None),
        "task_id": getattr(ti, "task_id", None),
        "run_id": getattr(ti, "run_id", None),
        "try_number": getattr(ti, "try_number", None),
        "log_url": getattr(ti, "log_url", None),
    }
    log.error("ALERT %s", json.dumps(payload))
