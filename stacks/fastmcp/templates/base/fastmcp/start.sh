#!/bin/bash
# start.sh — container entrypoint for the FastMCP server.
# Runs the server over the configured transport (HTTP in the container; the
# transport/host/port come from MCP_* env vars read in app/config.py).
set -e

echo "Starting FastMCP server (transport=${MCP_TRANSPORT:-http})..."
exec uv run python -m app
