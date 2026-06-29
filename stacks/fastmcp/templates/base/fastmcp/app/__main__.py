"""Entry point: `python -m app`.

Thin shell around `create_server()`: it only wires the transport from settings,
so all server composition stays in `server.py` and stays testable.
"""

from app.config import settings
from app.server import create_server


def main() -> None:
    app = create_server()
    if settings.transport == "stdio":
        app.run()
    else:
        app.run(transport=settings.transport, host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
