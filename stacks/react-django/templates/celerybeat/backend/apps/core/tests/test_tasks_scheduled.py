from apps.core.tasks_scheduled import heartbeat


def test_heartbeat_runs_eagerly():
    # .apply() runs the task eagerly in-process — no broker required.
    assert heartbeat.apply().get() == "alive"
