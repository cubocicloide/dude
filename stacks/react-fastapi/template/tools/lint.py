"""
Project-wide custom linter.

Usage:
    python -m tools.lint              # run from project root
    python -m tools.lint --root /path/to/project

Output: one diagnostic per line in tsc-compatible format:
    path/to/file(LINE,COL): severity CODE: message

Exit code:
    0 — no errors (warnings are non-blocking)
    1 — one or more errors found

Check catalogue:
    FE001  component_naming   — components/ dirs must be PascalCase
    FE002  component_files    — component dirs: only index.tsx, styles.module.css, types.tsx
    FE003  barrel_exports     — components/index.tsx must barrel-export all PascalCase children
    FE004  page_routes        — App.tsx imports ↔ pages/ dirs must match 1-to-1
    FE005  page_files         — page dirs: only index.tsx, styles.module.css, types.tsx
    FE006  hook_files         — use* dirs: only index.tsx and types.tsx
    FE007  hook_barrel        — hooks/index.tsx must barrel-export all use* dirs
    BE001  app_structure      — backend/app/ must have required dirs and files
    BE002  model_naming       — models/foo.py must define class Foo
    BE003  schema_naming      — schemas/foo.py must define FooBase/FooCreate/... (BaseModel)
    BE004  router_naming      — routers/foo.py must define router = APIRouter(...)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .checks.frontend.component_naming import ComponentNamingCheck
from .checks.frontend.component_files import ComponentFilesCheck
from .checks.frontend.barrel_exports import BarrelExportsCheck
from .checks.frontend.page_routes import PageRoutesCheck
from .checks.frontend.page_files import PageFilesCheck
from .checks.frontend.hook_files import HookFilesCheck
from .checks.frontend.hook_barrel import HookBarrelCheck
from .checks.backend.app_structure import AppStructureCheck
from .checks.backend.model_naming import ModelNamingCheck
from .checks.backend.schema_naming import SchemaNamingCheck
from .checks.backend.router_naming import RouterNamingCheck

CHECKS = [
    # Frontend
    ComponentNamingCheck(),
    ComponentFilesCheck(),
    BarrelExportsCheck(),
    PageRoutesCheck(),
    PageFilesCheck(),
    HookFilesCheck(),
    HookBarrelCheck(),
    # Backend
    AppStructureCheck(),
    ModelNamingCheck(),
    SchemaNamingCheck(),
    RouterNamingCheck(),
]


def run(root: Path) -> list:
    diagnostics = []
    for check in CHECKS:
        diagnostics.extend(check.run(root))
    return sorted(diagnostics, key=lambda d: (d.file, d.line, d.col))


def main() -> None:
    parser = argparse.ArgumentParser(description="Project custom linter")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Project root (default: current directory)",
    )
    args = parser.parse_args()

    diagnostics = run(args.root)
    for d in diagnostics:
        print(d)
    n = sum(1 for d in diagnostics if d.severity == "error")
    print(f"Found {n} error{'s' if n != 1 else ''}.", flush=True)
    sys.exit(1 if n else 0)


if __name__ == "__main__":
    main()
