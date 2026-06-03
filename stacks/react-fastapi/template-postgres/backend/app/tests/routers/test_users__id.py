"""Tests for routers/users__id.py."""

import pytest


@pytest.mark.anyio
async def test_get_users__id_not_found(client):
    response = await client.get("/api/users/99999")
    assert response.status_code == 404
