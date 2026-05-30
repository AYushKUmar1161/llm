from __future__ import annotations

from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "codeforge",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.index_repository",
        "app.tasks.run_agent",
    ],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task routing
    task_routes={
        "app.tasks.index_repository.*": {"queue": "indexing"},
        "app.tasks.run_agent.*": {"queue": "agents"},
    },

    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,

    # Result settings
    result_expires=86400,  # 24 hours
    result_backend_transport_options={
        "retry_policy": {
            "timeout": 5.0,
        }
    },

    # Worker settings
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,

    # Beat schedule (optional periodic tasks)
    beat_schedule={},
)
