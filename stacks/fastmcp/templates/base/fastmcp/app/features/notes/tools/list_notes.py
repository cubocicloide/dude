"""list_notes — list all stored notes."""

from app.features.notes._server import server
from app.features.notes.utils import service
from app.schemas.note import Note


@server.tool
def list_notes() -> list[Note]:
    """List all stored notes."""
    return service.store.list()
