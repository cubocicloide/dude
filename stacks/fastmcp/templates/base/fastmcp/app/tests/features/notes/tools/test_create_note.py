"""Integration test for the `create_note` tool."""

import pytest

from app.features.notes import server as notes_server


@pytest.mark.asyncio
async def test_create_note(make_client) -> None:
    async with make_client(notes_server) as client:
        result = await client.call_tool("create_note", {"title": "T", "body": "B"})
    assert result.data.title == "T"
    assert result.data.id  # an id was assigned
