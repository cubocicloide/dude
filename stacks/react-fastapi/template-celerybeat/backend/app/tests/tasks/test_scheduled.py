"""Tests for tasks/scheduled.py."""

from app.tasks.scheduled import heartbeat


def test_heartbeat_runs() -> None:
    assert heartbeat() is None
