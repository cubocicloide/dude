"""calculator — arithmetic tools + math constants as resources.

Exports `server` and imports its component packages (`tools/`, `resources/`,
`utils/`) so every `@server.*` in them registers. Importing the package fully
populates the sub-server (MCP003).
"""

from app.features.calculator._server import server
from app.utils.discovery import import_submodules

import_submodules(__name__, __path__)

__all__ = ["server"]
