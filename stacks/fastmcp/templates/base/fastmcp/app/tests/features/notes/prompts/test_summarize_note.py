"""Integration test for the `summarize_note` prompt."""

import pytest

from app.features.notes import server as notes_server


@pytest.mark.asyncio
async def test_summarize_note(make_client) -> None:
    async with make_client(notes_server) as client:
        result = await client.get_prompt("summarize_note", {"note_id": "1"})
    text = result.messages[0].content.text
    assert "notes://1" in text
