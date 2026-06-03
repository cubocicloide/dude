"""Tests for tasks/example.py."""

from app.tasks.example import add


def test_add() -> None:
    assert add(2, 3) == 5