"""Example Celery tasks."""

import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task
def add(x: int, y: int) -> int:
    """Add two numbers asynchronously.

    Usage::

        from app.tasks.example import add
        result = add.delay(3, 4)
        print(result.get())  # 7
    """
    logger.info("add(%s, %s)", x, y)
    return x + y
