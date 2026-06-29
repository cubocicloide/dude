"""multiply — multiply two numbers."""

from app.features.calculator._server import server
from app.features.calculator.utils import service
from app.schemas.calculator import CalculatorResult


@server.tool
def multiply(a: float, b: float) -> CalculatorResult:
    """Multiply two numbers."""
    return CalculatorResult(a=a, b=b, op="multiply", result=service.multiply(a, b))
