from apps.core.tasks import ping


def test_ping_returns_pong():
    # .apply() runs the task eagerly in-process — no broker required.
    assert ping.apply().get() == "pong"
