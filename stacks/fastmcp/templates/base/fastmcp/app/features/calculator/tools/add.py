"""add — sum two numbers."""

from app.features.calculator._server import server
from app.features.calculator.utils import service
from app.schemas.calculator import CalculatorResult


@server.tool
def add(a: float, b: float) -> CalculatorResult:
    """Add two numbers and return the result."""
    return CalculatorResult(a=a, b=b, op="add", result=service.add(a, b))
