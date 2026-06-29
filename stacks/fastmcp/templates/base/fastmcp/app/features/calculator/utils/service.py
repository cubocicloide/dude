"""Pure arithmetic logic — no FastMCP, no I/O, fully unit-testable.

Tools are thin adapters over these functions (MCP008); business rules are tested
here without any MCP machinery.
"""

from app.core.errors import DomainError


def add(a: float, b: float) -> float:
    return a + b


def subtract(a: float, b: float) -> float:
    return a - b


def multiply(a: float, b: float) -> float:
    return a * b


def divide(a: float, b: float) -> float:
    if b == 0:
        raise DomainError("division by zero is undefined")
    return a / b
