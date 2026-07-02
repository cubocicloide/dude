"""Smoke tests for the composed root server."""

import pytest
from starlette.testclient import TestClient

from app.server import discover_feature_servers


def test_discovers_both_features() -> None:
    names = {s.name for s in discover_feature_servers()}
    assert {"calculator", "notes"} <= names


@pytest.mark.asyncio
async def test_root_server_exposes_all_tools(app, make_client) -> None:
    async with make_client(app) as client:
        names = {t.name for t in await client.list_tools()}
    # Flat namespace: tools from every feature are visible without a prefix.
    assert {"add", "divide", "create_note", "list_notes"} <= names


@pytest.mark.asyncio
async def test_no_duplicate_tool_names(app, make_client) -> None:
    async with make_client(app) as client:
        names = [t.name for t in await client.list_tools()]
    assert len(names) == len(set(names)), "tool name collision across features (MCP010)"


def test_health_route(app) -> None:
    # The liveness probe must answer 200 without MCP headers or a session.
    with TestClient(app.http_app()) as http:
        response = http.get("/health")
    assert response.status_code == 200
    assert response.text == "ok"
