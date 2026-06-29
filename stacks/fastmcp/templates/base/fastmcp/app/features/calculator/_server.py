"""The calculator sub-server instance.

Defined in its own module so `tools.py` / `resources.py` can import it without a
circular dependency on the package `__init__`. The `name` must match the folder
(MCP003).
"""

from fastmcp import FastMCP

server = FastMCP(name="calculator")
