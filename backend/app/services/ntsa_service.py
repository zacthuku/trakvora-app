"""
NTSA / YourVerify integration for vehicle plate verification.

YourVerify (https://youverify.co) provides a REST API that queries Kenyan
NTSA registration records by number plate.

API key:  set YOURVERIFY_API_KEY in .env
Docs:     https://doc.youverify.co/know-your-customer-services-kyc/
          id-data-matching-eidv/kenya/verify-plate-number
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def verify_plate(plate: str) -> tuple[bool, str | None, str]:
    """
    Verify a Kenyan truck/vehicle registration plate against NTSA records.

    Returns:
        passed      – True if the plate is ACTIVE in NTSA records
        owner_name  – Registered owner name (for admin cross-reference), or None
        detail      – Human-readable status / error message
    """
    api_key = settings.yourverify_api_key
    if not api_key:
        logger.info("[NTSA] YourVerify API key not configured — manual plate check required")
        return False, None, "YourVerify not configured — manual check required"

    normalised = plate.upper().replace(" ", "").replace("-", "")
    payload = {"id": normalised, "isSubjectConsent": True}
    headers = {
        "token": api_key,
        "Content-Type": "application/json",
    }

    logger.info(f"[NTSA] Checking plate: {normalised}")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.yourverify_base_url}/v2/api/identity/ke/plate-number",
                json=payload,
                headers=headers,
            )
        data = resp.json()
    except Exception as exc:
        logger.error(f"[NTSA] YourVerify request failed: {exc}")
        return False, None, "Verification service unavailable — try again later"

    if data.get("success"):
        vehicle = data.get("data", {})
        status = (vehicle.get("status") or "").upper()
        owner = vehicle.get("ownerName") or vehicle.get("owner_name")
        if status == "ACTIVE":
            logger.info(f"[NTSA] Plate {normalised} verified — owner: {owner}")
            return True, owner, "Verified against NTSA records via YourVerify"
        # Plate found but not active (stolen, written-off, etc.)
        return False, owner, f"Plate found but status is '{status}' — review required"

    message = data.get("message") or data.get("error") or "Not found in NTSA records"
    logger.info(f"[NTSA] Plate {normalised} not verified: {message}")
    return False, None, message
