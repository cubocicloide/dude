"""Example Celery task — replace with real background work."""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def ping() -> str:
    """Trivial round-trip task, useful to verify the worker is alive."""
    logger.info("ping task executed")
    return "pong"
