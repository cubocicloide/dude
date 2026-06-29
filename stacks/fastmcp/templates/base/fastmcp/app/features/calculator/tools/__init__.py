"""Auto-register every tool module in this package (one tool per module)."""

from app.utils.discovery import import_submodules

import_submodules(__name__, __path__)
