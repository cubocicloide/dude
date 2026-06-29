"""Auto-register every resource module in this package (one resource per module)."""

from app.utils.discovery import import_submodules

import_submodules(__name__, __path__)
