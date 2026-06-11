"""
Celery application factory.

Broker:  Redis  (REDIS_URL env var)
Backend: Redis  (same instance, db 1)

Usage:
  celery -A app.workers.celery_app worker --loglevel=info
  celery -A app.workers.celery_app beat   --loglevel=info   # for periodic tasks
"""

from celery import Celery

from app.config import settings

app = Celery(
    "trakvora",
    broker=settings.redis_url,
    backend=settings.redis_url.replace("/0", "/1"),  # separate DB for results
    include=[
        "app.workers.tasks.email_tasks",
        "app.workers.tasks.sms_tasks",
        "app.workers.tasks.report_tasks",
        "app.workers.tasks.matching_tasks",
    ],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Nairobi",
    enable_utc=True,
    # Retry policy defaults
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Result expiry: 24 hours
    result_expires=86400,
    # Route long-running tasks to a dedicated queue
    task_routes={
        "app.workers.tasks.report_tasks.*": {"queue": "reports"},
        "app.workers.tasks.matching_tasks.*": {"queue": "matching"},
    },
)
