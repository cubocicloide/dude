"""Scheduled (periodic) Celery tasks — run by Celery Beat."""

import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task
def heartbeat() -> None:
    """Periodic heartbeat — fires every minute.

    Adjust the schedule in ``app/worker.py`` via ``beat_schedule``.
    """
    logger.info("Heartbeat tick")
