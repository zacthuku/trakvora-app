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
