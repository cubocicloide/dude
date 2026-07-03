FROM python:3.13-slim
WORKDIR /app

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

# Install all dependencies (including dev: pytest, ruff …)
COPY pyproject.toml .
RUN uv sync --no-cache

# Copy start script (applies migrations, starts the dev server)
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8000
CMD ["/start.sh"]
