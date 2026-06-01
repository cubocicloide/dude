"""Health-check router."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def get_health() -> dict[str, str]:
    """Health-check endpoint."""
    return {"status": "ok"}
