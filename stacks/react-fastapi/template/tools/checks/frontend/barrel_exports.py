"""
FE003 — barrel_exports

Every folder named ``components`` must have an ``index.tsx`` barrel file that:
    • exports every PascalCase child directory as a default re-export
    • contains only: blank lines, single-line comments (// ...), and re-export lines

Required export form:  export { default as Name } from "./Name";

Any missing export, missing barrel, or unrecognised line is an error.

Scope: frontend/src/**/components/
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "FE003"

_EXPORT_LINE = re.compile(
    r'^export \{ default as (?P<name>[A-Z][a-zA-Z0-9]+) \} from "\./(?P=name)";$'
)
_BLANK = re.compile(r"^\s*$")
_COMMENT = re.compile(r"^\s*//")
_PASCAL = re.compile(r"^[A-Z][a-zA-Z0-9]+$")


class BarrelExportsCheck(Check):
    """FE003: every components/ folder must have a complete barrel index.tsx."""

    def run(self, root: Path) -> list[Diagnostic]:
        diagnostics: list[Diagnostic] = []
        frontend_src = root / "frontend" / "src"
        if not frontend_src.exists():
            return []

        for components_dir in sorted(frontend_src.rglob("components")):
            if not components_dir.is_dir():
                continue
            barrel = components_dir / "index.tsx"
            pascal_children = _pascal_children(components_dir)

            if not barrel.exists():
                if pascal_children:
                    expected = "\n".join(
                        f'export {{ default as {n} }} from "./{n}";'
                        for n in pascal_children
                    )
                    diagnostics.append(
                        Diagnostic(
                            file=str(barrel.relative_to(root)),
                            line=1,
                            col=1,
                            severity="error",
                            code=CODE,
                            message=(
                                f"Missing barrel file '{barrel.relative_to(root)}'. "
                                f"Fix: create it with:\n{expected}"
                            ),
                        )
                    )
                continue

            diagnostics.extend(_check_barrel(barrel, root))
            diagnostics.extend(_check_missing_exports(barrel, pascal_children, root))

        return diagnostics


def _pascal_children(components_dir: Path) -> list[str]:
    return sorted(
        entry.name
        for entry in components_dir.iterdir()
        if entry.is_dir() and _PASCAL.match(entry.name)
    )


def _exported_names(barrel: Path) -> set[str]:
    names: set[str] = set()
    for line in barrel.read_text(encoding="utf-8").splitlines():
        m = _EXPORT_LINE.match(line.rstrip())
        if m:
            names.add(m.group("name"))
    return names


def _check_missing_exports(
    barrel: Path, pascal_children: list[str], root: Path
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    exported = _exported_names(barrel)
    rel = str(barrel.relative_to(root))

    for child in pascal_children:
        if child not in exported:
            diagnostics.append(
                Diagnostic(
                    file=rel,
                    line=1,
                    col=1,
                    severity="error",
                    code=CODE,
                    message=(
                        f"Barrel '{rel}' is missing an export for '{child}'. "
                        f'Fix: add  export {{ default as {child} }} from "./{child}";'
                    ),
                )
            )

    return diagnostics


def _check_barrel(barrel: Path, root: Path) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    rel = str(barrel.relative_to(root))

    for lineno, line in enumerate(barrel.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.rstrip()
        if _BLANK.match(stripped) or _COMMENT.match(stripped) or _EXPORT_LINE.match(stripped):
            continue
        diagnostics.append(
            Diagnostic(
                file=rel,
                line=lineno,
                col=1,
                severity="error",
                code=CODE,
                message=(
                    f"Unexpected line in barrel file. "
                    f'Only re-export lines are allowed: export {{ default as Foo }} from "./Foo";'
                ),
            )
        )

    return diagnostics
