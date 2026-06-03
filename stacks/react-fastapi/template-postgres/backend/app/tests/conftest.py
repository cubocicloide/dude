"""Pytest configuration and shared fixtures."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.database import get_db
from app.main import app as fastapi_app
from app.models import user as _user_model  # noqa: F401 — registers the User table with SQLModel.metadata


@pytest.fixture(name="db")
def db_fixture():
    """In-memory SQLite session for database tests."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
async def client(db: Session):
    """Async HTTP client with the FastAPI app wired to the in-memory DB."""
    fastapi_app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()
