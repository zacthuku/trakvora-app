import logging

import httpx

logger = logging.getLogger(__name__)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
_TIMEOUT_SECONDS = 5.0
_MAX_NAME_LENGTH = 480


async def reverse_geocode(lat: float, lng: float) -> str | None:
    """
    Return a human-readable place name for the given GPS coordinates using
    OpenStreetMap Nominatim (free, no API key required).

    Returns None on any error — callers should treat this as non-critical.
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            resp = await client.get(
                _NOMINATIM_URL,
                params={"lat": lat, "lon": lng, "format": "json"},
                headers={"User-Agent": "Trakvora/1.0 (trakvora.com)"},
            )
            resp.raise_for_status()
            data = resp.json()
            name = data.get("display_name") or data.get("name")
            if name:
                return name[:_MAX_NAME_LENGTH]
    except Exception as exc:  # noqa: BLE001
        logger.warning("reverse_geocode(%s, %s) failed: %s", lat, lng, exc)
    return None
