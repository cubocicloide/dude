"""Shared fixtures for the DAG integrity suite.

The suite runs inside the Airflow image (`dude test`), where dags/ and
plugins/ are mounted at /opt/airflow — but the paths are resolved relative to
this file, so `pytest airflow/tests` also works in any checkout with Airflow
installed.
"""

import os
import sys
from pathlib import Path

import pytest

AIRFLOW_DIR = Path(__file__).resolve().parents[1]
DAGS_DIR = AIRFLOW_DIR / "dags"
PLUGINS_DIR = AIRFLOW_DIR / "plugins"

# Parse only this project's DAGs, with the same settings the deployment uses.
os.environ.setdefault("AIRFLOW__CORE__LOAD_EXAMPLES", "false")
os.environ.setdefault("AIRFLOW__CORE__DAG_IGNORE_FILE_SYNTAX", "glob")
os.environ.setdefault("AIRFLOW__CORE__PLUGINS_FOLDER", str(PLUGINS_DIR))
os.environ.setdefault("AIRFLOW__CORE__DAGS_FOLDER", str(DAGS_DIR))

# `from lib…` / `from ops_toolkit…` — same sys.path Airflow itself uses.
for extra in (str(DAGS_DIR), str(PLUGINS_DIR)):
    if extra not in sys.path:
        sys.path.insert(0, extra)


@pytest.fixture(scope="session")
def dagbag():
    from airflow.models.dagbag import DagBag

    return DagBag(dag_folder=str(DAGS_DIR), include_examples=False)
