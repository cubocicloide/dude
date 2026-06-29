"""Centralised configuration — the ONLY place that reads the environment.

Every runtime knob is declared here as a typed field on `Settings`, populated
from `MCP_`-prefixed environment variables (or a local `.env`). No other module
may call `os.getenv` / `os.environ` (see RULES.md MCP014), so configuration is
discoverable, typed, and testable in one spot.
"""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Process-wide settings, loaded from the environment once at import time."""

    model_config = SettingsConfigDict(env_prefix="MCP_", env_file=".env", extra="ignore")

    server_name: str = "example-mcp"
    instructions: str = "Example FastMCP server scaffold (calculator + notes)."

    # Transport: "stdio" for local clients (Claude Desktop, IDEs), "http" to serve.
    transport: Literal["stdio", "http", "sse", "streamable-http"] = "stdio"
    host: str = "127.0.0.1"
    port: int = 8000


settings = Settings()
