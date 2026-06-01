"""
BE002 — model_naming

Each file inside backend/app/models/ (excluding __init__.py) must define
at least one top-level class whose name is the PascalCase equivalent of
the filename.

Example:
    user.py         → class User(...)
    user_group.py   → class UserGroup(...)

Scope: backend/app/models/
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "BE002"

_CLASS_RE = re.compile(r"^class\s+([A-Za-z][A-Za-z0-9]*)\s*[:(]", re.MULTILINE)


def _snake_to_pascal(name: str) -> str:
    return "".join(part.capitalize() for part in name.split("_"))


class ModelNamingCheck(Check):
    """BE002: model files must define a class matching their filename in PascalCase."""

    def run(self, root: Path) -> list[Diagnostic]:
        models_dir = root / "backend" / "app" / "models"
        if not models_dir.exists():
            return []

        diagnostics: list[Diagnostic] = []

        for py_file in sorted(models_dir.glob("*.py")):
            if py_file.name == "__init__.py":
                continue

            expected_class = _snake_to_pascal(py_file.stem)
            source = py_file.read_text(encoding="utf-8")
            top_level = _CLASS_RE.findall(source)
            rel = str(py_file.relative_to(root))

            if not top_level:
                diagnostics.append(
                    Diagnostic(
                        file=rel,
                        line=1,
                        col=1,
                        severity="error",
                        code=CODE,
                        message=(
                            f"'{py_file.name}' defines no top-level class. "
                            f"Expected: class {expected_class}(...)."
                        ),
                    )
                )
                continue

            if expected_class not in top_level:
                diagnostics.append(
                    Diagnostic(
                        file=rel,
                        line=1,
                        col=1,
                        severity="error",
                        code=CODE,
                        message=(
                            f"'{py_file.name}' must define a class named '{expected_class}'. "
                            f"Found: {', '.join(top_level)}."
                        ),
                    )
                )

        return diagnostics
