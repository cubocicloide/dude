"""Tests for queries/users.py."""

import pytest

from app.queries.users import UsersQueries


@pytest.mark.anyio
async def test_get_all_returns_list(db):
    queries = UsersQueries()
    result = queries.get_all(db)
    assert isinstance(result, list)
