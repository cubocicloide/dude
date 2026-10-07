---
"@cubocicloide/stack-react-fastapi": patch
---

Fix backend container crash on `dude up`: the scaffold pinned `psycopg2-binary`
while all `postgresql://` URLs rely on SQLAlchemy's default driver. SQLAlchemy
2.1 changed that default from psycopg2 to psycopg (v3), so a fresh `uv sync`
resolved 2.1.x and failed at migration time with `ModuleNotFoundError: No module
named 'psycopg'`. Switch the backend dependency to `psycopg[binary]` (psycopg v3),
matching the new default — no URL changes required.
