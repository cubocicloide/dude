"""Error types.

Services raise `DomainError` (transport-agnostic) so they stay pure and unit-
testable without importing FastMCP. The binding layer (tools/resources) catches
it and re-raises `ToolError`, whose message is the ONE thing surfaced to the
LLM/client — internal exceptions are never leaked verbatim.
"""

from fastmcp.exceptions import ToolError


class DomainError(Exception):
    """A predictable, user-facing failure raised by the service layer."""


__all__ = ["DomainError", "ToolError"]
