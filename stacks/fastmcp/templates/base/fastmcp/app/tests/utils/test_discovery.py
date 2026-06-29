"""Unit test for the global discovery helper."""

import app.features.calculator.tools as calc_tools
from app.utils.discovery import import_submodules


def test_import_submodules_discovers_tool_modules() -> None:
    names = import_submodules(calc_tools.__name__, calc_tools.__path__)
    leaves = {n.rsplit(".", 1)[1] for n in names}
    assert {"add", "subtract", "multiply", "divide"} <= leaves
