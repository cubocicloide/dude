"""Health-check router."""

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health")
async def get_health() -> HealthResponse:
    """Health-check endpoint."""
    return HealthResponse(status="ok")
