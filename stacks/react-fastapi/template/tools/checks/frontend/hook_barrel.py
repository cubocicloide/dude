"""
FE007 — hook_barrel

``frontend/src/hooks/index.tsx`` must re-export every ``use*`` child directory
using the barrel pattern:

    export { default as useFoo } from "./useFoo";

Extra lines that don't match the pattern are also flagged.

Scope: frontend/src/hooks/index.tsx
"""

from __future__ import annotations

import re
from pathlib import Path

from .._base import Check, Diagnostic

CODE = "FE007"
_HOOK_DIR = re.compile(r"^use[A-Z][a-zA-Z0-9]*$")
_BARREL_RE = re.compile(
    r'^export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*"\./(\w+)"\s*;?\s*$'
)
_BLANK_OR_COMMENT = re.compile(r"^\s*$|^\s*//")


class HookBarrelCheck(Check):
    """FE007: hooks/index.tsx must barrel-export every use* directory."""

    def run(self, root: Path) -> list[Diagnostic]:
        hooks_dir = root / "frontend" / "src" / "hooks"
        barrel = hooks_dir / "index.tsx"
        if not hooks_dir.exists():
            return []

        diagnostics: list[Diagnostic] = []
        rel = str(barrel.relative_to(root))

        expected: set[str] = {
            child.name
            for child in sorted(hooks_dir.iterdir())
            if child.is_dir() and _HOOK_DIR.match(child.name)
        }

        if not barrel.exists():
            if expected:
                diagnostics.append(
                    Diagnostic(
                        file=rel,
                        line=1,
                        col=1,
                        severity="error",
                        code=CODE,
                        message=(
                            "Missing barrel file hooks/index.tsx. "
                            f"Expected exports for: {', '.join(sorted(expected))}."
                        ),
                    )
                )
            return diagnostics

        exported: set[str] = set()
        for lineno, line in enumerate(barrel.read_text(encoding="utf-8").splitlines(), start=1):
            if _BLANK_OR_COMMENT.match(line):
                continue
            m = _BARREL_RE.match(line)
            if not m:
                diagnostics.append(
                    Diagnostic(
                        file=rel,
                        line=lineno,
                        col=1,
                        severity="error",
                        code=CODE,
                        message=(
                            "Unexpected line in hooks barrel. "
                            'Expected: export { default as useXxx } from "./useXxx";'
                        ),
                    )
                )
                continue
            exported.add(m.group(1))

        for name in sorted(expected - exported):
            diagnostics.append(
                Diagnostic(
                    file=rel,
                    line=1,
                    col=1,
                    severity="error",
                    code=CODE,
                    message=(
                        f"hooks/index.tsx is missing an export for '{name}'. "
                        f'Fix: add  export {{ default as {name} }} from "./{name}";'
                    ),
                )
            )

        return diagnostics
