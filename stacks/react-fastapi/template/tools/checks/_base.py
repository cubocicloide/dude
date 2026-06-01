"""
Base types for all custom lint checks.

Output format (tsc-compatible, parsed by VS Code's built-in $tsc problemMatcher):
    path/to/file(LINE,COL): severity CODE: message

LINE and COL are 1-based; use 1:1 for file- or directory-level diagnostics.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True)
class Diagnostic:
    file: str           # path relative to project root
    line: int           # 1-based
    col: int            # 1-based
    severity: Literal["error", "warning"]
    code: str           # e.g. "FE001"
    message: str

    def __str__(self) -> str:
        # tsc-compatible format — parsed by VS Code's built-in $tsc problemMatcher
        return f"{self.file}({self.line},{self.col}): {self.severity} {self.code}: {self.message}"


class Check:
    """Base class for a lint check. Subclass and override ``run()``."""

    def run(self, root: Path) -> list[Diagnostic]:
        raise NotImplementedError
