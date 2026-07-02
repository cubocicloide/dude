"""Root server factory — discovers feature sub-servers and mounts them.

Adding a feature is a pure drop-in: create a `features/<name>/` package that
exports a FastMCP `server` (see the existing features for the shape). The loader
finds it automatically — there is no central registry to edit, which is what
keeps the server scalable. The only contract is MCP003: each feature package
must export a module-level `server: FastMCP`.
"""

import importlib
import pkgutil

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from app import features
from app.config import settings


def discover_feature_servers() -> list[FastMCP]:
    """Import every (non-underscore) subpackage of `features/` and collect its
    exported `server`. Raises if a feature package violates the contract, so a
    malformed feature fails loudly at startup rather than silently vanishing."""
    servers: list[FastMCP] = []
    for info in pkgutil.iter_modules(features.__path__):
        if info.name.startswith("_"):
            continue
        module = importlib.import_module(f"{features.__name__}.{info.name}")
        server = getattr(module, "server", None)
        if not isinstance(server, FastMCP):
            raise RuntimeError(
                f"feature '{info.name}' must export a module-level FastMCP "
                f"`server` (see RULES.md MCP003)."
            )
        servers.append(server)
    return servers


def create_server() -> FastMCP:
    """Build the composed root server. Pure (no I/O, no transport) so tests can
    drive it via an in-memory client."""
    app = FastMCP(name=settings.server_name, instructions=settings.instructions)
    for feature_server in discover_feature_servers():
        app.mount(feature_server)

    # Plain-HTTP liveness probe (NOT an MCP endpoint): load balancers and
    # orchestrators need a route that answers 200 without MCP headers or a
    # session. Only served on the HTTP transports; inert over stdio.
    @app.custom_route("/health", methods=["GET"])
    async def health(_: Request) -> PlainTextResponse:
        return PlainTextResponse("ok")

    return app
