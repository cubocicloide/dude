"""
BE004 — router_naming

Each file inside backend/app/routers/ (excluding __init__.py) must define
an APIRouter instance assigned to the variable ``router``.

Example:
    router = APIRouter(...)

Scope: backend/app/routers/
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "BE004"

_ROUTER_RE = re.compile(r"^router\s*=\s*APIRouter\s*\(", re.MULTILINE)


class RouterNamingCheck(Check):
    """BE004: router files must define router = APIRouter(...)."""

    def run(self, root: Path) -> list[Diagnostic]:
        routers_dir = root / "backend" / "app" / "routers"
        if not routers_dir.exists():
            return []

        diagnostics: list[Diagnostic] = []

        for py_file in sorted(routers_dir.glob("*.py")):
            if py_file.name == "__init__.py":
                continue

            source = py_file.read_text(encoding="utf-8")
            rel = str(py_file.relative_to(root))

            if not _ROUTER_RE.search(source):
                diagnostics.append(
                    Diagnostic(
                        file=rel,
                        line=1,
                        col=1,
                        severity="error",
                        code=CODE,
                        message=(
                            f"'{py_file.name}' must define 'router = APIRouter(...)'. "
                            f"This is required for the router to be included in main.py."
                        ),
                    )
                )

        return diagnostics
