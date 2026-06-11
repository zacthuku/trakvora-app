"""
Heavy report generation tasks — runs on the 'reports' queue.

These are computationally intensive and should not block the API workers.
"""

import logging
import uuid

from app.workers.celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=1, queue="reports", name="reports.generate_fleet_report")
def generate_fleet_report(self, owner_id: str, report_type: str, fmt: str = "pdf"):
    """
    Generate a fleet report (PDF or XLSX) for a fleet owner.

    Returns the S3 URL (or local path) of the generated file.
    """
    try:
        import asyncio
        from app.services.reporting_service import generate_report_file
        from app.database import AsyncSessionLocal

        async def _run():
            async with AsyncSessionLocal() as db:
                return await generate_report_file(db, owner_id=uuid.UUID(owner_id), report_type=report_type, fmt=fmt)

        return asyncio.run(_run())
    except Exception as exc:
        logger.error("generate_fleet_report failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=1, queue="reports", name="reports.generate_platform_report")
def generate_platform_report(self, admin_id: str, report_type: str, fmt: str = "pdf"):
    """Generate a platform-wide admin report."""
    try:
        import asyncio
        from app.services.reporting_service import generate_report_file
        from app.database import AsyncSessionLocal

        async def _run():
            async with AsyncSessionLocal() as db:
                return await generate_report_file(db, admin_id=uuid.UUID(admin_id), report_type=report_type, fmt=fmt)

        return asyncio.run(_run())
    except Exception as exc:
        logger.error("generate_platform_report failed: %s", exc)
        raise self.retry(exc=exc)
