"""
FE002 — component_files

Every PascalCase directory inside a ``components/`` folder may only contain:
    • index.tsx          (mandatory)
    • styles.module.css  (optional)
    • types.tsx          (optional)
    • components/        (optional subdirectory for sub-components)

Any other file or directory triggers an error.
A missing ``index.tsx`` is also an error.

Scope: frontend/src/**
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "FE002"
_PASCAL = re.compile(r"^[A-Z][a-zA-Z0-9]+$")
_ALLOWED_FILES = {"index.tsx", "styles.module.css", "types.tsx"}
_ALLOWED_DIRS = {"components"}


class ComponentFilesCheck(Check):
    """FE002: component directories may only contain a defined set of files."""

    def run(self, root: Path) -> list[Diagnostic]:
        diagnostics: list[Diagnostic] = []
        frontend_src = root / "frontend" / "src"
        if not frontend_src.exists():
            return []

        for components_dir in sorted(frontend_src.rglob("components")):
            if not components_dir.is_dir():
                continue
            for child in sorted(components_dir.iterdir()):
                if not child.is_dir() or not _PASCAL.match(child.name):
                    continue
                diagnostics.extend(_check_component_dir(child, root))

        return diagnostics


def _check_component_dir(component: Path, root: Path) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    has_index = False

    for entry in sorted(component.iterdir()):
        if entry.is_file():
            if entry.name in _ALLOWED_FILES:
                if entry.name == "index.tsx":
                    has_index = True
            else:
                diagnostics.append(
                    Diagnostic(
                        file=str(entry.relative_to(root)),
                        line=1,
                        col=1,
                        severity="error",
                        code=CODE,
                        message=(
                            f"Unexpected file '{entry.name}' in component '{component.name}'. "
                            f"Allowed: {', '.join(sorted(_ALLOWED_FILES))}. "
                            f"Fix: delete or move into one of the allowed files."
                        ),
                    )
                )
        elif entry.is_dir():
            if entry.name not in _ALLOWED_DIRS:
                diagnostics.append(
                    Diagnostic(
                        file=str((entry / "index.tsx").relative_to(root)),
                        line=1,
                        col=1,
                        severity="error",
                        code=CODE,
                        message=(
                            f"Unexpected subdirectory '{entry.name}' inside component '{component.name}'. "
                            f"Sub-components must live under '{component.name}/components/'. "
                            f"Fix: move to '{component.relative_to(root)}/components/{entry.name}/'."
                        ),
                    )
                )

    if not has_index:
        diagnostics.append(
            Diagnostic(
                file=str((component / "index.tsx").relative_to(root)),
                line=1,
                col=1,
                severity="error",
                code=CODE,
                message=(
                    f"Component '{component.name}' is missing its mandatory entry point. "
                    f"Fix: create '{component.relative_to(root)}/index.tsx'."
                ),
            )
        )

    return diagnostics
