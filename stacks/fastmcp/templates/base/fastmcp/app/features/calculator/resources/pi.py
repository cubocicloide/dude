"""pi — the mathematical constant pi."""

import math

from app.features.calculator._server import server


@server.resource("calc://constants/pi")
def pi() -> float:
    """The mathematical constant pi (π)."""
    return math.pi
