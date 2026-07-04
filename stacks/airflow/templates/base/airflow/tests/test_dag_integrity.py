"""DAG integrity suite — fails fast on anything that would break the deployment.

Run with `dude test`. Every check here mirrors a convention enforced (more
cheaply, without importing Airflow) by `dude lint`; this suite is the
ground truth because it executes the real import machinery.
"""

from pathlib import Path


def test_no_import_errors(dagbag):
    assert dagbag.import_errors == {}, (
        "DAG files failed to import:\n"
        + "\n".join(f"{f}: {e}" for f, e in dagbag.import_errors.items())
    )


def test_at_least_one_dag(dagbag):
    assert len(dagbag.dags) > 0, "No DAGs were discovered under airflow/dags/"


def test_dag_id_matches_filename(dagbag):
    for dag_id, dag in dagbag.dags.items():
        stem = Path(dag.fileloc).stem
        assert dag_id == stem, f"dag_id {dag_id!r} != file name {stem!r} ({dag.fileloc})"


def test_every_dag_is_tagged(dagbag):
    for dag_id, dag in dagbag.dags.items():
        assert dag.tags, f"{dag_id} has no tags"


def test_every_dag_has_owner_and_retries(dagbag):
    """DEFAULT_ARGS applied — owner is not Airflow's placeholder, retries set."""
    for dag_id, dag in dagbag.dags.items():
        owner = dag.default_args.get("owner")
        assert owner and owner != "airflow", f"{dag_id} lacks a real owner (got {owner!r})"
        assert dag.default_args.get("retries") is not None, f"{dag_id} sets no retries"


def test_no_unbounded_schedules(dagbag):
    """catchup=True with a schedule requires deliberate intent — keep it rare."""
    offenders = [
        dag_id
        for dag_id, dag in dagbag.dags.items()
        if dag.catchup and dag.timetable.can_be_scheduled
    ]
    assert offenders == [], f"catchup=True on: {offenders} — is the back-fill intended?"
