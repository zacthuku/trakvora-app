"""
Async SMS tasks via AfricasTalking.
"""

import logging

from app.workers.celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=3, default_retry_delay=20, name="sms.send_otp")
def send_otp_sms(self, phone: str, otp_code: str):
    try:
        import asyncio
        from app.services.sms_service import send_otp_sms as _send
        asyncio.run(_send(phone, otp_code))
    except Exception as exc:
        logger.warning("send_otp_sms failed (%s), retrying…", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2, default_retry_delay=30, name="sms.send_bid_received")
def send_bid_received_sms(self, phone: str, load_title: str, bid_amount: float):
    try:
        import asyncio
        from app.services.sms_service import send_bid_received_sms as _send
        asyncio.run(_send(phone, load_title, bid_amount))
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2, default_retry_delay=30, name="sms.send_shipment_status")
def send_shipment_status_sms(self, phone: str, status: str, load_title: str):
    try:
        import asyncio
        from app.services.sms_service import send_shipment_status_sms as _send
        asyncio.run(_send(phone, status, load_title))
    except Exception as exc:
        raise self.retry(exc=exc)
