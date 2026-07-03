from rest_framework.test import APIClient


def test_health_returns_ok() -> None:
    """GET /api/health/ is public and returns the ok payload."""
    response = APIClient().get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_rejects_post() -> None:
    """Only GET is exposed on the health endpoint."""
    response = APIClient().post("/api/health/", {})

    assert response.status_code == 405
