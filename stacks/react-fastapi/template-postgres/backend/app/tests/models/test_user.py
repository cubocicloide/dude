"""Tests for models/user.py."""

import pytest

from app.models.user import User


def test_user_model_fields():
    user = User(id=1, full_name="Alice", email="alice@example.com")
    assert user.id == 1
    assert user.full_name == "Alice"
    assert user.email == "alice@example.com"
