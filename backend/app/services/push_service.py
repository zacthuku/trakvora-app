"""
Firebase Cloud Messaging (FCM) push notification service.

Requires FIREBASE_SERVICE_ACCOUNT_KEY env var to be set to a JSON string
of the Firebase service account key. If not set, push calls are silently no-ops.
"""
from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

_firebase_app = None
_firebase_init_attempted = False


def _get_firebase_app():
    global _firebase_app, _firebase_init_attempted
    if _firebase_init_attempted:
        return _firebase_app
    _firebase_init_attempted = True
    if not settings.firebase_service_account_key:
        logger.info("FIREBASE_SERVICE_ACCOUNT_KEY not set — push notifications disabled")
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        service_account = json.loads(settings.firebase_service_account_key)
        cred = credentials.Certificate(service_account)
        _firebase_app = firebase_admin.initialize_app(cred, name="trakvora")
        logger.info("Firebase Admin SDK initialised")
    except Exception as exc:
        logger.warning("Firebase initialisation failed: %s", exc)
        _firebase_app = None
    return _firebase_app


async def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    Send a single FCM push notification.
    Returns True on success, False on failure (never raises).
    """
    app = _get_firebase_app()
    if app is None:
        return False
    try:
        from firebase_admin import messaging
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=fcm_token,
        )
        messaging.send(msg, app=app)
        return True
    except Exception as exc:
        logger.warning("FCM send failed (token %s…): %s", fcm_token[:10], exc)
        return False


async def send_push_to_user(
    user_id: uuid.UUID | str,
    title: str,
    body: str,
    data: dict | None = None,
    db: AsyncSession | None = None,
) -> bool:
    """
    Look up the user's FCM token from the DB and send a push notification.
    Silently returns False if the user has no FCM token or DB is not provided.
    """
    if db is None:
        return False
    try:
        from app.models.user import User
        user = (await db.execute(
            select(User).where(User.id == uuid.UUID(str(user_id)))
        )).scalar_one_or_none()
        if not user or not user.fcm_token:
            return False
        return await send_push(user.fcm_token, title, body, data)
    except Exception as exc:
        logger.warning("send_push_to_user failed for %s: %s", user_id, exc)
        return False
