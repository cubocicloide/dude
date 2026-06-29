"""Integration test for the `e` resource."""

import pytest

from app.features.calculator import server as calculator_server


@pytest.mark.asyncio
async def test_e(make_client) -> None:
    async with make_client(calculator_server) as client:
        result = await client.read_resource("calc://constants/e")
    assert result[0].text.startswith("2.718")
