"""Periodic tasks driven by Celery Beat.

The schedule lives in ``config/celery.py`` (``app.conf.beat_schedule``); the
`celery_beat` compose service dispatches these to the worker.
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def heartbeat() -> str:
    """Log a liveness heartbeat — replace with real scheduled work."""
    logger.info("beat heartbeat")
    return "alive"
