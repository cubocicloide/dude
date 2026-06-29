"""notes — a small CRUD-ish feature showing Context, resource templates, prompts.

Demonstrates the full FastMCP vocabulary in one feature: tools that use the
injected `Context`, a parameterised resource (`notes://{note_id}`), and a prompt.
Importing the package registers every component (MCP003).
"""

from app.features.notes._server import server
from app.utils.discovery import import_submodules

import_submodules(__name__, __path__)

__all__ = ["server"]
