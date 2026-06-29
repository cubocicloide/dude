"""Notes business logic — an in-memory store, pure and unit-testable.

A module-level singleton store is the feature's state, shared by tools and
resources. Swapping it for a database later touches only this file (MCP008).
"""

from itertools import count

from app.core.errors import DomainError
from app.schemas.note import Note


class NoteStore:
    """Trivial in-memory note repository."""

    def __init__(self) -> None:
        self._notes: dict[str, Note] = {}
        self._ids = count(1)

    def create(self, title: str, body: str) -> Note:
        note_id = str(next(self._ids))
        note = Note(id=note_id, title=title, body=body)
        self._notes[note_id] = note
        return note

    def get(self, note_id: str) -> Note:
        try:
            return self._notes[note_id]
        except KeyError as exc:
            raise DomainError(f"note '{note_id}' not found") from exc

    def list(self) -> list[Note]:
        return list(self._notes.values())


store = NoteStore()
