"""Integration test for the `read_note` resource template."""

import pytest

from app.features.notes import server as notes_server


@pytest.mark.asyncio
async def test_read_note(make_client) -> None:
    async with make_client(notes_server) as client:
        created = await client.call_tool("create_note", {"title": "Shopping", "body": "milk, eggs"})
        result = await client.read_resource(f"notes://{created.data.id}")
    assert "milk, eggs" in result[0].text
