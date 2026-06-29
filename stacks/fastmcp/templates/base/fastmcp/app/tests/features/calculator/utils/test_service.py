"""Unit tests for the calculator service — pure logic, no MCP machinery."""

import pytest

from app.core.errors import DomainError
from app.features.calculator.utils import service


def test_add() -> None:
    assert service.add(2, 3) == 5


def test_subtract() -> None:
    assert service.subtract(5, 3) == 2


def test_multiply() -> None:
    assert service.multiply(4, 3) == 12


def test_divide() -> None:
    assert service.divide(10, 2) == 5


def test_divide_by_zero_raises_domain_error() -> None:
    with pytest.raises(DomainError):
        service.divide(1, 0)
