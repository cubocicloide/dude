"""
BE001 — app_structure

backend/app/ must contain the expected directories and files.

Required directories: models, routers, schemas
Optional directories: core, tests, utils
Required files: __init__.py, main.py

Scope: backend/app/
"""

from __future__ import annotations

from pathlib import Path

from .._base import Check, Diagnostic

CODE = "BE001"

_REQUIRED_DIRS = {"models", "routers", "schemas"}
_OPTIONAL_DIRS = {"core", "tests", "utils", "fixtures", "migrations"}
_REQUIRED_FILES = {"__init__.py", "main.py"}
_IGNORED = {"__pycache__"}


class AppStructureCheck(Check):
    """BE001: backend/app/ must have the required structure."""

    def run(self, root: Path) -> list[Diagnostic]:
        app_dir = root / "backend" / "app"
        if not app_dir.exists():
            return []

        diagnostics: list[Diagnostic] = []
        allowed_dirs = _REQUIRED_DIRS | _OPTIONAL_DIRS | _IGNORED

        dirs = {e.name for e in app_dir.iterdir() if e.is_dir()}
        files = {e.name for e in app_dir.iterdir() if e.is_file()}

        for req in sorted(_REQUIRED_DIRS - dirs):
            diagnostics.append(
                Diagnostic(
                    file=str((app_dir / req).relative_to(root)),
                    line=1,
                    col=1,
                    severity="error",
                    code=CODE,
                    message=(
                        f"Missing required directory 'backend/app/{req}/'. "
                        f"Fix: create it and add an __init__.py."
                    ),
                )
            )

        for req in sorted(_REQUIRED_FILES - files):
            diagnostics.append(
                Diagnostic(
                    file=str((app_dir / req).relative_to(root)),
                    line=1,
                    col=1,
                    severity="warning",
                    code=CODE,
                    message=f"Missing required file 'backend/app/{req}'.",
                )
            )

        for unexpected in sorted(dirs - allowed_dirs):
            diagnostics.append(
                Diagnostic(
                    file=str((app_dir / unexpected).relative_to(root)),
                    line=1,
                    col=1,
                    severity="warning",
                    code=CODE,
                    message=(
                        f"Unexpected directory 'backend/app/{unexpected}/'. "
                        f"Known directories: {', '.join(sorted(_REQUIRED_DIRS | _OPTIONAL_DIRS))}."
                    ),
                )
            )

        return diagnostics
