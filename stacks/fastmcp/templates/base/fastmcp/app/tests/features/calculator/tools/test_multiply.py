"""Integration test for the `multiply` tool."""

import pytest

from app.features.calculator import server as calculator_server


@pytest.mark.asyncio
async def test_multiply(make_client) -> None:
    async with make_client(calculator_server) as client:
        result = await client.call_tool("multiply", {"a": 4, "b": 3})
    assert result.data.result == 12
    assert result.data.op == "multiply"
