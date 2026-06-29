"""create_note — create a note (demonstrates the injected Context)."""

from fastmcp import Context

from app.features.notes._server import server
from app.features.notes.utils import service
from app.schemas.note import Note


@server.tool
async def create_note(title: str, body: str, ctx: Context) -> Note:
    """Create a note and return it (with its assigned id)."""
    note = service.store.create(title, body)
    await ctx.info(f"created note {note.id}: {note.title!r}")
    return note
