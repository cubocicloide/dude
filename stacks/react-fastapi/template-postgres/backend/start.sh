#!/bin/bash
# start.sh — container entrypoint when PostgreSQL is enabled.
# 1. Waits for the DB to accept connections.
# 2. Runs Alembic migrations.
# 3. Starts uvicorn.
set -e

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

echo "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until python -c "
import socket, os, sys
try:
    s = socket.create_connection(
        (os.getenv('POSTGRES_HOST', 'postgres'), int(os.getenv('POSTGRES_PORT', '5432'))),
        timeout=1,
    )
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
    echo "  Not ready — retrying in 1s..."
    sleep 1
done

echo "PostgreSQL is up. Running migrations..."
uv run alembic upgrade head

echo "Starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
