"""Health-check router."""

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Check service health",
    description=(
        'Returns `{"status": "ok"}` while the process is accepting requests. This '
        "is a liveness probe, not a status page — it does not test the database, "
        "the cache or any downstream service."
    ),
)
async def get_health() -> HealthResponse:
    """Health-check endpoint."""
    return HealthResponse(status="ok")
