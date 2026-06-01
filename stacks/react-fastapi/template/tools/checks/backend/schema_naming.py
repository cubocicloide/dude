"""
BE003 — schema_naming

Each file inside backend/app/schemas/ (excluding __init__.py) must only define
Pydantic BaseModel (or SQLModel) subclasses. Every class name must start with
the PascalCase prefix derived from the filename.

Example:
    user.py  →  UserBase, UserCreate, UserRead  (all starting with "User")

Scope: backend/app/schemas/
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "BE003"

# Matches:  class FooBar(Something, Another):
_CLASS_RE = re.compile(r"^class\s+([A-Za-z][A-Za-z0-9]*)\s*\(([^)]*)\)\s*:", re.MULTILINE)
_PYDANTIC_BASE = re.compile(r"\bBaseModel\b|\bSQLModel\b")


def _snake_to_pascal(name: str) -> str:
    return "".join(part.capitalize() for part in name.split("_"))


class SchemaNamingCheck(Check):
    """BE003: schema classes must extend BaseModel and use the file's PascalCase prefix."""

    def run(self, root: Path) -> list[Diagnostic]:
        schemas_dir = root / "backend" / "app" / "schemas"
        if not schemas_dir.exists():
            return []

        diagnostics: list[Diagnostic] = []

        for py_file in sorted(schemas_dir.glob("*.py")):
            if py_file.name == "__init__.py":
                continue

            expected_prefix = _snake_to_pascal(py_file.stem)
            source = py_file.read_text(encoding="utf-8")
            rel = str(py_file.relative_to(root))

            for m in _CLASS_RE.finditer(source):
                class_name = m.group(1)
                bases = m.group(2)
                line = source[: m.start()].count("\n") + 1

                if not _PYDANTIC_BASE.search(bases):
                    diagnostics.append(
                        Diagnostic(
                            file=rel,
                            line=line,
                            col=1,
                            severity="error",
                            code=CODE,
                            message=(
                                f"Class '{class_name}' in '{py_file.name}' does not extend "
                                f"BaseModel. All classes in schemas/ must be Pydantic models."
                            ),
                        )
                    )

                if not class_name.startswith(expected_prefix):
                    diagnostics.append(
                        Diagnostic(
                            file=rel,
                            line=line,
                            col=1,
                            severity="error",
                            code=CODE,
                            message=(
                                f"Class '{class_name}' in '{py_file.name}' must start with "
                                f"'{expected_prefix}'. "
                                f"Example: {expected_prefix}Base, {expected_prefix}Create, "
                                f"{expected_prefix}Read."
                            ),
                        )
                    )

        return diagnostics
