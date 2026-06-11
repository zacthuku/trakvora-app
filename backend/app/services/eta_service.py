"""
ETA (Estimated Time of Arrival) computation service.

Priority:
  1. Google Maps Distance Matrix API   — when GOOGLE_MAPS_SERVER_API_KEY is set
  2. Haversine + road factor fallback  — always available (uses estimate_eta_minutes
     from core/geofencing.py with 1.35× road factor)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings
from app.core.geofencing import estimate_eta_minutes

logger = logging.getLogger(__name__)

_MAPS_DISTANCE_MATRIX_URL = (
    "https://maps.googleapis.com/maps/api/distancematrix/json"
)
_DEFAULT_SPEED_KMH = 60.0


async def compute_eta(
    current_lat: float,
    current_lon: float,
    dest_lat: float,
    dest_lon: float,
    speed_kmh: float | None = None,
) -> datetime:
    """
    Return the UTC datetime when the truck is expected to arrive at (dest_lat, dest_lon).

    Tries Google Maps Distance Matrix API first; falls back to Haversine + road factor.
    """
    # ── 1. Google Maps Distance Matrix ────────────────────────────────────────
    if settings.google_maps_server_api_key:
        try:
            minutes = await _google_eta_minutes(current_lat, current_lon, dest_lat, dest_lon)
            if minutes is not None:
                return datetime.now(timezone.utc) + timedelta(minutes=minutes)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Google Distance Matrix failed, falling back to Haversine: %s", exc)

    # ── 2. Haversine fallback ────────────────────────────────────────────────
    avg_speed = speed_kmh if speed_kmh and speed_kmh > 5 else _DEFAULT_SPEED_KMH
    minutes = estimate_eta_minutes(current_lat, current_lon, dest_lat, dest_lon, avg_speed)
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


async def _google_eta_minutes(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> int | None:
    """
    Call Google Maps Distance Matrix API.
    Returns driving duration in minutes, or None on failure.
    """
    params = {
        "origins": f"{origin_lat},{origin_lon}",
        "destinations": f"{dest_lat},{dest_lon}",
        "mode": "driving",
        "departure_time": "now",
        "traffic_model": "best_guess",
        "key": settings.google_maps_server_api_key,
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(_MAPS_DISTANCE_MATRIX_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    try:
        element = data["rows"][0]["elements"][0]
        if element["status"] != "OK":
            return None
        # duration_in_traffic if available, else duration
        duration_sec = element.get("duration_in_traffic", element["duration"])["value"]
        return int(duration_sec / 60)
    except (KeyError, IndexError, TypeError):
        return None
