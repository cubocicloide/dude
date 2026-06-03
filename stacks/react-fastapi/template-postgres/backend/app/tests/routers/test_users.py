"""Tests for routers/users.py."""

import pytest


@pytest.mark.anyio
async def test_get_users(client):
    response = await client.get("/api/users")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
