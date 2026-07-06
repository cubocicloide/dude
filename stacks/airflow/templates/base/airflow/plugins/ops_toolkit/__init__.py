"""ops_toolkit — the project's reference Airflow plugin.

A plugin is a package under airflow/plugins/ whose __init__.py registers an
AirflowPlugin subclass (lint rule AF008). This one wires three extension
points worth knowing:

* **listeners**  — fleet-wide observability: one structured log line per
                   DAG-run success/failure, without touching any DAG
                   (ship it to Slack/Teams by editing listeners.py)
* **macros**     — Jinja helpers available in every templated field as
                   ``{{ macros.ops_toolkit.<name>(...) }}``
* **timetables** — custom schedules; ``WorkdayTimetable`` runs Mon–Fri and
                   becomes valid in any DAG's ``schedule=`` once registered here

Copy this layout for your own plugins: one package per plugin, implementation
in modules, registration here.
"""

from airflow.plugins_manager import AirflowPlugin

from ops_toolkit import listeners
from ops_toolkit.macros import ds_add_business_days, deploy_env
from ops_toolkit.timetables import WorkdayTimetable


class OpsToolkitPlugin(AirflowPlugin):
    name = "ops_toolkit"

    listeners = [listeners]
    macros = [ds_add_business_days, deploy_env]
    timetables = [WorkdayTimetable]
