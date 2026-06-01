"""
FE001 — component_naming

Every directory that is a direct child of a folder named ``components``
must be PascalCase (``^[A-Z][a-zA-Z0-9]+$``).

Scope: frontend/src/** (applies to both src/components/ and page-local components/).
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "FE001"
_PASCAL = re.compile(r"^[A-Z][a-zA-Z0-9]+$")


class ComponentNamingCheck(Check):
    """FE001: component directory names must be PascalCase."""

    def run(self, root: Path) -> list[Diagnostic]:
        diagnostics: list[Diagnostic] = []
        frontend_src = root / "frontend" / "src"
        if not frontend_src.exists():
            return []

        for components_dir in sorted(frontend_src.rglob("components")):
            if not components_dir.is_dir():
                continue
            for child in sorted(components_dir.iterdir()):
                if not child.is_dir():
                    continue
                if not _PASCAL.match(child.name):
                    candidate = child / "index.tsx"
                    target = candidate if candidate.exists() else child
                    diagnostics.append(
                        Diagnostic(
                            file=str(target.relative_to(root)),
                            line=1,
                            col=1,
                            severity="error",
                            code=CODE,
                            message=f"Component directory '{child.name}' must be PascalCase.",
                        )
                    )

        return diagnostics
