"""Integration test for the `subtract` tool."""

import pytest

from app.features.calculator import server as calculator_server


@pytest.mark.asyncio
async def test_subtract(make_client) -> None:
    async with make_client(calculator_server) as client:
        result = await client.call_tool("subtract", {"a": 5, "b": 3})
    assert result.data.result == 2
    assert result.data.op == "subtract"
