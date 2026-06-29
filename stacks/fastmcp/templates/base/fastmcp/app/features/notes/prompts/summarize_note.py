"""summarize_note — prompt asking the model to summarise a note."""

from app.features.notes._server import server


@server.prompt
def summarize_note(note_id: str) -> str:
    """Build a prompt asking the model to summarise a note by id."""
    return (
        f"Read the note at the resource `notes://{note_id}` and summarise it "
        f"in one sentence, preserving any action items."
    )
