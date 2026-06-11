"""
Async email tasks — offloads email delivery from the request/response cycle.

All functions mirror the signatures in email_service.py so call-sites can
easily swap  await email_service.send_*()  for  send_*.delay()  or
send_*.apply_async().
"""

import logging

from app.workers.celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=3, default_retry_delay=30, name="email.send_otp")
def send_otp_email(self, email: str, full_name: str, otp_code: str):
    try:
        import asyncio
        from app.services.email_service import send_otp_email as _send
        asyncio.run(_send(email, full_name, otp_code))
    except Exception as exc:
        logger.warning("send_otp_email failed (%s), retrying…", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=30, name="email.send_welcome")
def send_welcome_email(self, email: str, full_name: str, role: str):
    try:
        import asyncio
        from app.services.email_service import send_welcome_email as _send
        asyncio.run(_send(email, full_name, role))
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=30, name="email.send_bid_received")
def send_bid_received_email(self, email: str, full_name: str, load_title: str, bid_amount: float, bidder_name: str):
    try:
        import asyncio
        from app.services.email_service import send_bid_received_email as _send
        asyncio.run(_send(email, full_name, load_title, bid_amount, bidder_name))
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=30, name="email.send_bid_accepted")
def send_bid_accepted_email(self, email: str, full_name: str, load_title: str, bid_amount: float):
    try:
        import asyncio
        from app.services.email_service import send_bid_accepted_email as _send
        asyncio.run(_send(email, full_name, load_title, bid_amount))
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=30, name="email.send_shipment_in_transit")
def send_shipment_in_transit_email(self, email: str, full_name: str, load_title: str, driver_name: str, eta: str | None):
    try:
        import asyncio
        from app.services.email_service import send_shipment_in_transit_email as _send
        asyncio.run(_send(email, full_name, load_title, driver_name, eta))
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=30, name="email.send_shipment_delivered")
def send_shipment_delivered_email(self, email: str, full_name: str, load_title: str, amount_released: float):
    try:
        import asyncio
        from app.services.email_service import send_shipment_delivered_email as _send
        asyncio.run(_send(email, full_name, load_title, amount_released))
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2, default_retry_delay=60, name="email.send_subscription_past_due")
def send_subscription_past_due_email(self, email: str, full_name: str, plan_name: str):
    try:
        import asyncio
        from app.services.email_service import send_subscription_past_due_email as _send
        asyncio.run(_send(email, full_name, plan_name))
    except Exception as exc:
        raise self.retry(exc=exc)
