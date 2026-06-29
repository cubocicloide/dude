"""divide — divide one number by another."""

from app.core.errors import DomainError, ToolError
from app.features.calculator._server import server
from app.features.calculator.utils import service
from app.schemas.calculator import CalculatorResult


@server.tool
def divide(a: float, b: float) -> CalculatorResult:
    """Divide `a` by `b`. Errors if `b` is zero."""
    try:
        return CalculatorResult(a=a, b=b, op="divide", result=service.divide(a, b))
    except DomainError as exc:
        raise ToolError(str(exc)) from exc
