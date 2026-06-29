FROM python:3.13-slim
WORKDIR /app

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

# Install all dependencies (including dev: pytest, ruff, mypy …).
# Only the manifest is copied, so `app/` is provided by the compose bind-mount
# in development (live reload); the image stays a thin runtime.
COPY pyproject.toml .
RUN uv sync --no-cache

# Copy start script (starts the MCP server over the configured transport).
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8000
CMD ["/start.sh"]
