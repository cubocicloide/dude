"""read_note — read a single note by id (resource template)."""

from typing import Any

from app.core.errors import DomainError, ToolError
from app.features.notes._server import server
from app.features.notes.utils import service


@server.resource("notes://{note_id}", mime_type="application/json")
def read_note(note_id: str) -> dict[str, Any]:
    """Read a single note by id."""
    try:
        return service.store.get(note_id).model_dump()
    except DomainError as exc:
        raise ToolError(str(exc)) from exc
