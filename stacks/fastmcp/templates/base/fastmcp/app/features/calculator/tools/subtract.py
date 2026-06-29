"""subtract — subtract one number from another."""

from app.features.calculator._server import server
from app.features.calculator.utils import service
from app.schemas.calculator import CalculatorResult


@server.tool
def subtract(a: float, b: float) -> CalculatorResult:
    """Subtract `b` from `a`."""
    return CalculatorResult(a=a, b=b, op="subtract", result=service.subtract(a, b))
