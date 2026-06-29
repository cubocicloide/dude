"""Example FastMCP server — a scalable, testable scaffold.

The package is organised as a *modular monolith*: each bounded context lives in
its own feature package under `features/`, exposing a self-contained FastMCP
sub-server. `server.create_server()` auto-discovers and mounts them into one
root server. See README.md for the rationale and RULES.md for the deterministic
conventions a linter can enforce.
"""

__all__ = ["__version__"]

__version__ = "0.0.1"
