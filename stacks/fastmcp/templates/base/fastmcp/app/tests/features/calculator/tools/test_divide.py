"""Integration test for the `divide` tool."""

import pytest
from fastmcp.exceptions import ToolError

from app.features.calculator import server as calculator_server


@pytest.mark.asyncio
async def test_divide(make_client) -> None:
    async with make_client(calculator_server) as client:
        result = await client.call_tool("divide", {"a": 10, "b": 2})
    assert result.data.result == 5


@pytest.mark.asyncio
async def test_divide_by_zero_surfaces_tool_error(make_client) -> None:
    async with make_client(calculator_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool("divide", {"a": 1, "b": 0})
