---
"@cubocicloide/stack-react-fastapi": patch
---

Fix scaffolded backend test suite to pass out of the box

- `conftest.py`: switch to `ASGITransport` (httpx ≥ 0.27 dropped `app=` kwarg), make `client` fixture async
- Postgres overlay `conftest.py`: add `db` fixture (in-memory SQLite via `StaticPool`) and override `get_db` dependency so router tests never need a real Postgres connection
- `test_user.py`: fix field reference `name` → `full_name` to match the actual `User` model
- `user.py`: replace deprecated `datetime.utcnow` with `datetime.now(UTC)` (Python 3.13)
- `config.py.hbs`: replace deprecated `class Config` with `model_config = SettingsConfigDict(...)` (Pydantic v2)
- `pyproject.toml.hbs`: add `anyio[trio]` dev-dependency and `[tool.pytest.ini_options] asyncio_mode = "strict"`
