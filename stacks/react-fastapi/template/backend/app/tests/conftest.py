"""Pytest configuration and shared fixtures."""

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.fixture
def client():
    """Async HTTP client pointed at the FastAPI app."""
    return AsyncClient(app=app, base_url="http://test")
