"""Feature packages.

Each subpackage is a bounded context exporting a FastMCP `server`. They are
auto-discovered by `app.server.discover_feature_servers()`; there is no
manual registration. Underscore-prefixed names are ignored by the loader.
"""
