"""Integration test for the `list_notes` tool."""

import pytest

from app.features.notes import server as notes_server


@pytest.mark.asyncio
async def test_list_notes(make_client) -> None:
    async with make_client(notes_server) as client:
        await client.call_tool("create_note", {"title": "a", "body": "1"})
        await client.call_tool("create_note", {"title": "b", "body": "2"})
        result = await client.call_tool("list_notes", {})
    assert len(result.data) == 2
