"""Jinja macros exposed to every templated field.

Registered by the plugin, they live under the plugin's namespace:

    BashOperator(
        task_id="report",
        bash_command="run_report --until {{ macros.ops_toolkit.ds_add_business_days(ds, 3) }}",
    )
"""

import os
from datetime import datetime, timedelta


def ds_add_business_days(ds: str, n: int) -> str:
    """Add ``n`` business days (Mon–Fri) to a ``YYYY-MM-DD`` date string."""
    date = datetime.strptime(ds, "%Y-%m-%d")
    step = 1 if n >= 0 else -1
    remaining = abs(n)
    while remaining:
        date += timedelta(days=step)
        if date.weekday() < 5:  # 0–4 = Mon–Fri
            remaining -= 1
    return date.strftime("%Y-%m-%d")


def deploy_env() -> str:
    """Which environment this deployment is (local, dev, prod, …)."""
    return os.getenv("DEPLOY_ENV", "local")
