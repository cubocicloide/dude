"""Shared test fixtures."""

from typing import Any

import pytest
from fastmcp import Client, FastMCP

from app.server import create_server


@pytest.fixture
def app() -> FastMCP:
    """The fully composed root server (all features mounted)."""
    return create_server()


@pytest.fixture
def make_client():
    """Return a factory that wraps a FastMCP server in an in-memory client.

    Usage:
        async with make_client(some_server) as client:
            await client.call_tool(...)
    """

    def _factory(server: FastMCP) -> Client[Any]:
        return Client(server)

    return _factory
