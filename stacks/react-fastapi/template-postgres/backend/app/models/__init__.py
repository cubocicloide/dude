"""Models package — all imports must live here so Alembic discovers every table."""

from app.models.user import User

__all__ = ["User"]
