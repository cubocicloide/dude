"""e — Euler's number."""

import math

from app.features.calculator._server import server


@server.resource("calc://constants/e")
def e() -> float:
    """Euler's number (e)."""
    return math.e
