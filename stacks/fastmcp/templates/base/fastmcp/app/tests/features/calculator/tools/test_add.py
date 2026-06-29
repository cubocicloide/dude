"""Integration test for the `add` tool."""

import pytest

from app.features.calculator import server as calculator_server


@pytest.mark.asyncio
async def test_add(make_client) -> None:
    async with make_client(calculator_server) as client:
        result = await client.call_tool("add", {"a": 2, "b": 3})
    assert result.data.result == 5
    assert result.data.op == "add"
