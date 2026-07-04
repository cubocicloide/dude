"""Project-wide DAG policy — every DAG imports DEFAULT_ARGS from here (rule AF005).

Change retries/backoff/ownership in ONE place; extend per-DAG with
`default_args={**DEFAULT_ARGS, "retries": 5}` when a pipeline needs more.
"""

from datetime import timedelta

from lib.callbacks import notify_failure

# The team that owns pipelines by default — shows in the UI's Owner column.
OWNER = "data-platform"

DEFAULT_ARGS = {
    "owner": OWNER,
    "retries": 2,
    "retry_delay": timedelta(minutes=2),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=30),
    "on_failure_callback": notify_failure,
}
