"""Auto-register every prompt module in this package (one prompt per module)."""

from app.utils.discovery import import_submodules

import_submodules(__name__, __path__)
