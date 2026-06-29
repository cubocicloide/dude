"""Note schemas — every class here is prefixed `Note` (MCP011)."""

from pydantic import BaseModel, Field


class Note(BaseModel):
    """A stored note."""

    id: str = Field(description="Stable identifier.")
    title: str = Field(description="Short title.")
    body: str = Field(description="Free-form note content.")
