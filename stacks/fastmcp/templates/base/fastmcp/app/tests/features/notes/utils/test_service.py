"""Unit tests for the notes service."""

import pytest

from app.core.errors import DomainError
from app.features.notes.utils.service import NoteStore


def test_create_and_get() -> None:
    store = NoteStore()
    note = store.create("title", "body")
    assert store.get(note.id) == note


def test_list() -> None:
    store = NoteStore()
    store.create("a", "1")
    store.create("b", "2")
    assert len(store.list()) == 2


def test_get_missing_raises() -> None:
    store = NoteStore()
    with pytest.raises(DomainError):
        store.get("nope")
