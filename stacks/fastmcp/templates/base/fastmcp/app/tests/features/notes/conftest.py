"""Notes-scoped fixtures: reset the in-memory store before each test."""

import pytest

from app.features.notes.utils import service
from app.features.notes.utils.service import NoteStore


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch) -> None:
    """Each notes test starts with an empty, isolated store."""
    monkeypatch.setattr(service, "store", NoteStore())
