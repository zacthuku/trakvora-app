import asyncio
import hashlib
import hmac
import json
import logging
import time

import httpx

from app.config import settings
from app.models.user import KycStatus, User

logger = logging.getLogger(__name__)

_SMILE_URL = "https://api.smileidentity.com/v1/id_verification"

ID_TYPE_MAP = {
    "NATIONAL_ID":       "NATIONAL_ID",
    "PASSPORT":          "PASSPORT",
    "DRIVERS_LICENSE":   "DRIVERS_LICENSE",
    "VOTER_ID":          "VOTER_ID",
}


def _build_sec_key(timestamp: int, api_key: str) -> str:
    """HMAC-SHA256 security key required by Smile Identity."""
    message = f"{timestamp}{api_key}"
    return hmac.new(api_key.encode(), message.encode(), hashlib.sha256).hexdigest()


def _verify_sync(partner_id: str, api_key: str, id_type: str, id_number: str, country: str) -> KycStatus:
    timestamp = int(time.time())
    sec_key = _build_sec_key(timestamp, api_key)
    payload = {
        "partner_id": partner_id,
        "sec_key": sec_key,
        "timestamp": timestamp,
        "country": country,
        "id_type": ID_TYPE_MAP.get(id_type, id_type),
        "id_number": id_number,
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(_SMILE_URL, json=payload)
            data = resp.json()
    except Exception as exc:
        logger.error(f"[KYC] Smile Identity request failed: {exc}")
        return KycStatus.pending

    result_code = str(data.get("result", {}).get("ResultCode", ""))
    # Smile Identity: 1012 = Found, others = not verified
    if result_code == "1012":
        return KycStatus.approved
    logger.info(f"[KYC] Non-verified result: {json.dumps(data)[:300]}")
    return KycStatus.rejected


async def submit_kyc(user: User, id_type: str, id_number: str) -> tuple[KycStatus, str | None]:
    """
    Verify user identity via Smile Identity.
    Returns (new_status, rejection_reason).

    Falls back to KycStatus.pending for manual admin review when:
    - No API key is configured
    - Network or API error occurs
    """
    country = (user.country or "KE").upper()
    logger.info(f"[KYC] Submitting for user {user.id} | type={id_type} | country={country}")

    partner_id = getattr(settings, "smile_identity_partner_id", "")
    api_key = getattr(settings, "smile_identity_api_key", "")

    if not api_key or not partner_id:
        logger.info("[KYC] No Smile Identity credentials — queued for manual review")
        return KycStatus.pending, None

    new_status = await asyncio.to_thread(
        _verify_sync, partner_id, api_key, id_type, id_number, country
    )

    reason = None
    if new_status == KycStatus.rejected:
        reason = "Identity could not be verified automatically. Contact support if you believe this is an error."

    return new_status, reason
