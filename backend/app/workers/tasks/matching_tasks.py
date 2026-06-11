"""
Smart matching tasks — updates the live availability index in Redis.

Runs on the 'matching' queue.
"""

import logging

from app.workers.celery_app import app

logger = logging.getLogger(__name__)


@app.task(name="matching.refresh_carrier_index")
def refresh_carrier_index(country_code: str = "KE"):
    """
    Rebuild the Redis availability index for all active carriers in a country.

    Called:
    - When a truck becomes active / inactive
    - When a driver's availability_status changes
    - Every 5 minutes as a heartbeat (via Celery beat)
    """
    try:
        import asyncio
        from app.services.matching_service import rebuild_availability_index
        from app.database import AsyncSessionLocal

        async def _run():
            async with AsyncSessionLocal() as db:
                await rebuild_availability_index(db, country_code=country_code)

        asyncio.run(_run())
        logger.info("Carrier index refreshed for %s", country_code)
    except Exception as exc:
        logger.error("refresh_carrier_index failed: %s", exc)
        raise


@app.task(name="matching.update_carrier_score")
def update_carrier_score(owner_id: str):
    """
    Recompute and cache a single carrier's match score after a trip completes.
    """
    try:
        import asyncio
        from app.services.matching_service import recompute_carrier_score
        from app.database import AsyncSessionLocal
        import uuid

        async def _run():
            async with AsyncSessionLocal() as db:
                await recompute_carrier_score(db, owner_id=uuid.UUID(owner_id))

        asyncio.run(_run())
    except Exception as exc:
        logger.error("update_carrier_score failed: %s", exc)
        raise
