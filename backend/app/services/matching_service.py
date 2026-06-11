"""
Smart load ↔ vehicle matching engine.

Scores available carriers against a load and returns ranked candidates.
Scoring dimensions (weighted sum → 0–100):
  - Proximity to pickup             25 pts
  - Truck type compatibility        25 pts
  - Capacity match                  20 pts
  - Carrier rating                  15 pts
  - Price history / bid behaviour   10 pts
  - Response rate                    5 pts
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CarrierCandidate:
    user_id: str
    truck_id: str
    truck_type: str
    capacity_tonnes: float
    current_lat: float | None
    current_lon: float | None
    rating: float = 5.0          # 1–5
    total_trips: int = 0
    avg_bid_ratio: float = 1.0   # avg(bid / price_kes) — lower is better for shipper
    response_rate: float = 1.0   # fraction of offers responded to (0–1)
    service_type: str = "truck"


@dataclass
class ScoredCandidate:
    carrier: CarrierCandidate
    score: float
    score_breakdown: dict = field(default_factory=dict)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _proximity_score(carrier: CarrierCandidate, pickup_lat: float, pickup_lon: float) -> float:
    """25 pts max. Full score within 20 km; zero beyond 300 km."""
    if carrier.current_lat is None or carrier.current_lon is None:
        return 10.0  # unknown location — partial credit
    dist = _haversine_km(carrier.current_lat, carrier.current_lon, pickup_lat, pickup_lon)
    if dist <= 20:
        return 25.0
    if dist >= 300:
        return 0.0
    return round(25.0 * (1 - (dist - 20) / 280), 2)


def _type_score(carrier: CarrierCandidate, required_type: str | None) -> float:
    """25 pts max. Exact match = 25, compatible = 12, any = 5."""
    if not required_type:
        return 15.0
    if carrier.truck_type == required_type:
        return 25.0
    # Compatible substitutions
    compatible: dict[str, set[str]] = {
        "flatbed":  {"lowbed"},
        "dry_van":  {"flatbed"},
        "tipper":   {"flatbed"},
        "van":      {"pickup"},
    }
    if carrier.truck_type in compatible.get(required_type, set()):
        return 12.0
    return 5.0


def _capacity_score(carrier: CarrierCandidate, weight_tonnes: float) -> float:
    """20 pts max. Penalise under-capacity (0 pts) and significant over-capacity."""
    if carrier.capacity_tonnes < weight_tonnes:
        return 0.0
    excess_ratio = carrier.capacity_tonnes / max(weight_tonnes, 0.1)
    if excess_ratio <= 1.5:
        return 20.0
    if excess_ratio <= 3.0:
        return 12.0
    return 6.0  # gross over-capacity wastes vehicle


def _rating_score(carrier: CarrierCandidate) -> float:
    """15 pts max. Linear mapping 1–5 → 0–15."""
    return round(max(0.0, (carrier.rating - 1) / 4 * 15), 2)


def _price_score(carrier: CarrierCandidate) -> float:
    """10 pts max. Lower avg bid ratio = more competitive pricing."""
    ratio = carrier.avg_bid_ratio
    if ratio <= 0.9:
        return 10.0
    if ratio >= 1.3:
        return 0.0
    return round(10.0 * (1.3 - ratio) / 0.4, 2)


def _response_score(carrier: CarrierCandidate) -> float:
    """5 pts max. Response rate 0–1 → 0–5."""
    return round(carrier.response_rate * 5, 2)


def rank_carriers(
    candidates: list[CarrierCandidate],
    pickup_lat: float,
    pickup_lon: float,
    required_truck_type: str | None,
    weight_tonnes: float,
    top_n: int = 10,
) -> list[ScoredCandidate]:
    """
    Score and rank carriers for a given load.

    Returns the top_n candidates sorted by descending score.
    """
    scored: list[ScoredCandidate] = []

    for c in candidates:
        prox  = _proximity_score(c, pickup_lat, pickup_lon)
        typ   = _type_score(c, required_truck_type)
        cap   = _capacity_score(c, weight_tonnes)
        rat   = _rating_score(c)
        price = _price_score(c)
        resp  = _response_score(c)
        total = round(prox + typ + cap + rat + price + resp, 2)

        scored.append(ScoredCandidate(
            carrier=c,
            score=total,
            score_breakdown={
                "proximity": prox,
                "truck_type": typ,
                "capacity": cap,
                "rating": rat,
                "price_history": price,
                "response_rate": resp,
            },
        ))

    scored.sort(key=lambda s: s.score, reverse=True)
    return scored[:top_n]


# ── Redis availability index ───────────────────────────────────────────────────
#
# Carrier scores are cached in a Redis sorted set: carriers:{country_code}
# Each member is a JSON blob of CarrierCandidate fields; score is a generic
# 0–100 matching score computed against a representative NBI→MSA corridor.
#
# The index is rebuilt on startup (via Celery task or direct call) and updated
# incrementally when a shipment is delivered or a driver changes availability.

import json
import logging

_INDEX_KEY_PREFIX = "carriers"
_INDEX_TTL_SECONDS = 3600  # 1 hour

logger = logging.getLogger(__name__)


def _carrier_to_json(c: CarrierCandidate) -> str:
    return json.dumps({
        "user_id":        c.user_id,
        "truck_id":       c.truck_id,
        "truck_type":     c.truck_type,
        "capacity_tonnes": c.capacity_tonnes,
        "current_lat":    c.current_lat,
        "current_lon":    c.current_lon,
        "rating":         c.rating,
        "total_trips":    c.total_trips,
        "avg_bid_ratio":  c.avg_bid_ratio,
        "response_rate":  c.response_rate,
        "service_type":   c.service_type,
    })


def _json_to_carrier(blob: str) -> CarrierCandidate:
    d = json.loads(blob)
    return CarrierCandidate(**d)


async def rebuild_availability_index(db, country_code: str = "KE") -> int:
    """
    Query all active trucks + drivers and write their scores to a Redis sorted set.
    Uses Nairobi→Mombasa as the representative corridor for scoring.
    Returns the number of carriers indexed.
    """
    try:
        from app.core.redis_client import get_redis
        redis = await get_redis()
    except Exception:
        logger.warning("rebuild_availability_index: Redis unavailable, skipping")
        return 0

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.truck import Truck
    from app.models.user import User, UserRole
    from app.models.shipment import Shipment
    from app.models.load import LoadStatus

    # Nairobi → Mombasa reference corridor
    REF_PICKUP_LAT, REF_PICKUP_LON = -1.286389, 36.817223
    REF_WEIGHT = 10.0

    # Find owners with at least one active truck
    result = await db.execute(
        select(Truck).where(
            Truck.is_active == True,  # noqa: E712
        )
    )
    trucks = result.scalars().all()

    # Gather carrier candidates
    candidates: list[tuple[CarrierCandidate, float]] = []  # (carrier, score)
    for truck in trucks:
        # Skip if truck is currently on an active shipment
        active_ship = (await db.execute(
            select(Shipment).where(
                Shipment.truck_id == truck.id,
                Shipment.status.in_([
                    LoadStatus.en_route_pickup,
                    LoadStatus.loaded,
                    LoadStatus.in_transit,
                ]),
            )
        )).scalar_one_or_none()
        if active_ship:
            continue

        # Get owner rating (simplified: use 5.0 default)
        carrier = CarrierCandidate(
            user_id=str(truck.owner_id),
            truck_id=str(truck.id),
            truck_type=truck.truck_type.value if hasattr(truck.truck_type, "value") else str(truck.truck_type),
            capacity_tonnes=float(truck.capacity_tonnes or 10.0),
            current_lat=truck.current_latitude,
            current_lon=truck.current_longitude,
            rating=float(truck.verification_score or 4.0) if hasattr(truck, "verification_score") else 4.0,
            total_trips=0,
            avg_bid_ratio=1.0,
            response_rate=1.0,
            service_type="truck",
        )
        scored = rank_carriers([carrier], REF_PICKUP_LAT, REF_PICKUP_LON, None, REF_WEIGHT, top_n=1)
        if scored:
            candidates.append((carrier, scored[0].score))

    if not candidates:
        return 0

    key = f"{_INDEX_KEY_PREFIX}:{country_code}"
    pipe = redis.pipeline()
    pipe.delete(key)
    for carrier, score in candidates:
        pipe.zadd(key, {_carrier_to_json(carrier): score})
    pipe.expire(key, _INDEX_TTL_SECONDS)
    await pipe.execute()

    logger.info("Rebuilt carrier index for %s: %d carriers", country_code, len(candidates))
    return len(candidates)


async def recompute_carrier_score(db, owner_id: str, country_code: str = "KE") -> None:
    """Update a single carrier's entry in the Redis index after a rating change."""
    try:
        from app.core.redis_client import get_redis
        redis = await get_redis()
    except Exception:
        return

    from sqlalchemy import select
    from app.models.truck import Truck

    result = await db.execute(
        select(Truck).where(
            Truck.owner_id == owner_id,
            Truck.is_active == True,  # noqa: E712
        )
    )
    truck = result.scalars().first()
    if not truck:
        return

    REF_PICKUP_LAT, REF_PICKUP_LON = -1.286389, 36.817223
    REF_WEIGHT = 10.0
    carrier = CarrierCandidate(
        user_id=str(truck.owner_id),
        truck_id=str(truck.id),
        truck_type=truck.truck_type.value if hasattr(truck.truck_type, "value") else str(truck.truck_type),
        capacity_tonnes=float(truck.capacity_tonnes or 10.0),
        current_lat=truck.current_latitude,
        current_lon=truck.current_longitude,
        rating=float(truck.verification_score or 4.0) if hasattr(truck, "verification_score") else 4.0,
        total_trips=0,
        avg_bid_ratio=1.0,
        response_rate=1.0,
    )
    scored = rank_carriers([carrier], REF_PICKUP_LAT, REF_PICKUP_LON, None, REF_WEIGHT, top_n=1)
    if not scored:
        return

    key = f"{_INDEX_KEY_PREFIX}:{country_code}"
    # Remove old entries for this owner (ZRANGEBYLEX or scan)
    members = await redis.zrange(key, 0, -1)
    to_remove = [m for m in members if f'"user_id": "{owner_id}"' in m]
    if to_remove:
        await redis.zrem(key, *to_remove)
    await redis.zadd(key, {_carrier_to_json(carrier): scored[0].score})


async def get_top_carriers_from_cache(country_code: str = "KE", n: int = 50) -> list[CarrierCandidate] | None:
    """
    Return the top-n carriers from the Redis index.
    Returns None if Redis is unavailable or the index is empty (caller should fall back to DB).
    """
    try:
        from app.core.redis_client import get_redis
        redis = await get_redis()
        key = f"{_INDEX_KEY_PREFIX}:{country_code}"
        blobs = await redis.zrevrange(key, 0, n - 1)
        if not blobs:
            return None
        return [_json_to_carrier(b) for b in blobs]
    except Exception:
        return None
