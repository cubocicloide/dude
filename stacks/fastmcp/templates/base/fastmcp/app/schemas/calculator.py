"""Calculator schemas — every class here is prefixed `Calculator` (MCP011)."""

from pydantic import BaseModel, Field


class CalculatorResult(BaseModel):
    """The result of a binary arithmetic operation."""

    a: float = Field(description="Left operand.")
    b: float = Field(description="Right operand.")
    op: str = Field(description="Operation performed (add|subtract|multiply|divide).")
    result: float = Field(description="The computed result.")
