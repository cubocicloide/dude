"""Import helpers for convention-based auto-registration.

Tools/resources/prompts register themselves as a side effect of being imported
(the `@server.*` decorator runs at import time). `import_submodules` imports
every module in a package so dropping a new `tools/<name>.py` in is enough to
register it — no manual list to maintain.
"""

import importlib
import pkgutil


def import_submodules(package_name: str, package_path: list[str]) -> list[str]:
    """Import every non-underscore submodule/subpackage of `package_name`.

    Returns the dotted names imported (handy for assertions in tests).
    """
    imported: list[str] = []
    for info in pkgutil.iter_modules(package_path):
        if info.name.startswith("_"):
            continue
        name = f"{package_name}.{info.name}"
        importlib.import_module(name)
        imported.append(name)
    return imported
