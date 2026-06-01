"""
FE006 — hook_files

Every directory inside ``hooks/`` whose name starts with ``use`` may only contain:
    • index.tsx   (mandatory)
    • types.tsx   (optional)

Any other file or directory triggers an error.
A missing ``index.tsx`` is also an error.

Scope: frontend/src/hooks/
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "FE006"
_HOOK_DIR = re.compile(r"^use[A-Z][a-zA-Z0-9]*$")
_ALLOWED_FILES = {"index.tsx", "types.tsx"}


class HookFilesCheck(Check):
    """FE006: hook directories may only contain index.tsx and types.tsx."""

    def run(self, root: Path) -> list[Diagnostic]:
        hooks_dir = root / "frontend" / "src" / "hooks"
        if not hooks_dir.exists():
            return []

        diagnostics: list[Diagnostic] = []

        for child in sorted(hooks_dir.iterdir()):
            if not child.is_dir() or not _HOOK_DIR.match(child.name):
                continue
            diagnostics.extend(_check_hook_dir(child, root))

        return diagnostics


def _check_hook_dir(hook: Path, root: Path) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    has_index = False

    for entry in sorted(hook.iterdir()):
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
                            f"Unexpected file '{entry.name}' in hook '{hook.name}'. "
                            f"Allowed: {', '.join(sorted(_ALLOWED_FILES))}."
                        ),
                    )
                )
        elif entry.is_dir():
            diagnostics.append(
                Diagnostic(
                    file=str(entry.relative_to(root)),
                    line=1,
                    col=1,
                    severity="error",
                    code=CODE,
                    message=(
                        f"Unexpected subdirectory '{entry.name}' inside hook '{hook.name}'. "
                        f"Hooks must not contain subdirectories."
                    ),
                )
            )

    if not has_index:
        diagnostics.append(
            Diagnostic(
                file=str((hook / "index.tsx").relative_to(root)),
                line=1,
                col=1,
                severity="error",
                code=CODE,
                message=(
                    f"Hook '{hook.name}' is missing its mandatory entry point. "
                    f"Fix: create '{hook.relative_to(root)}/index.tsx'."
                ),
            )
        )

    return diagnostics
