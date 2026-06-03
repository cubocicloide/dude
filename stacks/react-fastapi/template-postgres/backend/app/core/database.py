"""Database engine and session dependency."""

import os

from sqlmodel import Session, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/app")

engine = create_engine(DATABASE_URL)


def get_db():
    """Yield a SQLModel session (use as a FastAPI Dependency)."""
    with Session(engine) as session:
        yield session
