"""Integration test for the `pi` resource."""

import pytest

from app.features.calculator import server as calculator_server


@pytest.mark.asyncio
async def test_pi(make_client) -> None:
    async with make_client(calculator_server) as client:
        result = await client.read_resource("calc://constants/pi")
    assert "3.14159" in result[0].text
