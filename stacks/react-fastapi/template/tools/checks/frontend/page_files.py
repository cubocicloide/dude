"""
FE005 — page_files

Every page directory (a directory inside ``pages/`` that contains an
``index.tsx``, excluding ``components/`` sub-trees) may only contain:
    • index.tsx          (mandatory)
    • styles.module.css  (optional)
    • types.tsx          (optional)
    • subdirectories     (valid route segments or ``components/``)

Any other file triggers an error.

Scope: frontend/src/pages/**/
"""

from __future__ import annotations

from pathlib import Path

from .._base import Check, Diagnostic

CODE = "FE005"

_ALLOWED_FILES = {"index.tsx", "styles.module.css", "types.tsx"}


class PageFilesCheck(Check):
    """FE005: page directories may not contain arbitrary files."""

    def run(self, root: Path) -> list[Diagnostic]:
        pages_dir = root / "frontend" / "src" / "pages"
        if not pages_dir.exists():
            return []

        diagnostics: list[Diagnostic] = []

        diagnostics.extend(_check_page_dir(pages_dir, root))

        for index_file in sorted(pages_dir.rglob("index.tsx")):
            parent = index_file.parent
            if parent == pages_dir:
                continue
            rel_parts = parent.relative_to(pages_dir).parts
            if "components" in rel_parts:
                continue
            diagnostics.extend(_check_page_dir(parent, root))

        return diagnostics


def _check_page_dir(page: Path, root: Path) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []

    for entry in sorted(page.iterdir()):
        if entry.is_dir():
            continue
        if entry.name not in _ALLOWED_FILES:
            diagnostics.append(
                Diagnostic(
                    file=str(entry.relative_to(root)),
                    line=1,
                    col=1,
                    severity="error",
                    code=CODE,
                    message=(
                        f"Unexpected file '{entry.name}' in page directory "
                        f"'{page.relative_to(root)}'. "
                        f"Allowed: {', '.join(sorted(_ALLOWED_FILES))}."
                    ),
                )
            )

    return diagnostics
