"""
FE004 — page_routes

Routes imported in ``App.tsx`` and directories inside ``pages/`` must be in
perfect 1-to-1 correspondence.

A "page import" is any line in App.tsx of the form:
    import Something from "@/pages/foo";     → key: "foo"
    import Something from "./pages/foo";     → key: "foo"
    import Something from "../pages/foo";    → key: "foo"

A "page directory" is any directory inside ``frontend/src/pages/`` that
contains an ``index.tsx`` and is not reached through a ``components/`` segment.

Two errors are reported:
    • FE004-MISSING-PAGE  — App.tsx imports a page that has no matching directory
    • FE004-MISSING-ROUTE — A pages/ directory exists but is not imported in App.tsx

Scope: frontend/src/App.tsx  ←→  frontend/src/pages/
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "FE004"

# Matches @/pages/..., ./pages/..., ../pages/... (single or double quotes)
_IMPORT_RE = re.compile(r'from\s+["\'](?:@/pages|\.\.?(?:/[^"\']*)?/pages)(/[^"\']*)?["\']')


class PageRoutesCheck(Check):
    """FE004: routes in App.tsx and directories in pages/ must match 1-to-1."""

    def run(self, root: Path) -> list[Diagnostic]:
        app_tsx = root / "frontend" / "src" / "App.tsx"
        pages_dir = root / "frontend" / "src" / "pages"

        if not app_tsx.exists() or not pages_dir.exists():
            return []

        imported = _parse_imports(app_tsx)
        on_disk = _scan_pages(pages_dir)

        diagnostics: list[Diagnostic] = []
        app_rel = str(app_tsx.relative_to(root))

        for key in sorted(imported - on_disk):
            page_path = f"pages/{key}" if key else "pages"
            diagnostics.append(
                Diagnostic(
                    file=app_rel,
                    line=_import_line(app_tsx, key),
                    col=1,
                    severity="error",
                    code="FE004-MISSING-PAGE",
                    message=(
                        f"App.tsx imports '{page_path}' but 'frontend/src/{page_path}/index.tsx' "
                        f"does not exist. Fix: create the page or remove the import."
                    ),
                )
            )

        for key in sorted(on_disk - imported):
            page_path = f"pages/{key}/index.tsx" if key else "pages/index.tsx"
            diagnostics.append(
                Diagnostic(
                    file=f"frontend/src/{page_path}",
                    line=1,
                    col=1,
                    severity="error",
                    code="FE004-MISSING-ROUTE",
                    message=(
                        f"'frontend/src/{page_path}' exists but is not imported in App.tsx. "
                        f"Fix: add the import or delete the page directory."
                    ),
                )
            )

        return diagnostics


def _parse_imports(app_tsx: Path) -> set[str]:
    keys: set[str] = set()
    for m in _IMPORT_RE.finditer(app_tsx.read_text(encoding="utf-8")):
        suffix = (m.group(1) or "").strip("/")
        keys.add(suffix)
    return keys


def _scan_pages(pages_dir: Path) -> set[str]:
    keys: set[str] = set()
    for index_file in sorted(pages_dir.rglob("index.tsx")):
        parent = index_file.parent
        rel_parts = parent.relative_to(pages_dir).parts
        if "components" in rel_parts:
            continue
        key = "/".join(rel_parts)
        keys.add(key)
    return keys


def _import_line(app_tsx: Path, key: str) -> int:
    needle = f"pages/{key}" if key else "/pages"
    for lineno, line in enumerate(app_tsx.read_text(encoding="utf-8").splitlines(), start=1):
        if needle in line:
            return lineno
    return 1
