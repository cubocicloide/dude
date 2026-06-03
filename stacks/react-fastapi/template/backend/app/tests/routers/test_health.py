"""Tests for routers/health.py."""

import pytest


@pytest.mark.anyio
async def test_get_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
