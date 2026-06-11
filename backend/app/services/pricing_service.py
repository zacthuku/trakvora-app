"""
Dynamic pricing engine — market-calibrated with corridor, fuel, seasonal, and demand signals.

Formula:
  price = corridor_base_rate × distance_km
          × fuel_adjustment_factor       (from FuelIndex — weekly updated from internet)
          × seasonal_factor              (from SEASONAL_FACTORS[country][month])
          × platform_demand_factor       (from _DEMAND_INDEX in-memory cache)
          × cargo_multiplier             (refrigerated, hazardous, etc.)
          × urgency_multiplier           (same_day=1.5x, etc.)
          × weight_multiplier            (<5t=1.0, 5-15t=1.05, etc.)
          + fuel_surcharge_flat          (distance-banded, in local currency)

Corridor base rates are stored in the corridor_rates DB table (seeded from market research,
auto-adjusted by the weekly fuel price refresh job — no admin intervention needed).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.models.load import CargoType
from app.models.service_type import VehicleServiceType

# ── Hardcoded fallback base rates (used when no DB corridor rate exists) ──────

_FALLBACK_BASE_RATE: dict[str, float] = {
    VehicleServiceType.truck:       125.0,  # Updated from 120 (KTA 14% increase 2026)
    VehicleServiceType.van:          55.0,
    VehicleServiceType.pickup:       40.0,
    VehicleServiceType.parcel:       25.0,
    VehicleServiceType.movers:       80.0,
    VehicleServiceType.airfreight: 1200.0,
}

MINIMUM_PRICE: dict[str, float] = {
    VehicleServiceType.truck:      5_000.0,
    VehicleServiceType.van:        1_500.0,
    VehicleServiceType.pickup:       800.0,
    VehicleServiceType.parcel:       250.0,
    VehicleServiceType.movers:     3_000.0,
    VehicleServiceType.airfreight: 15_000.0,
}

# ── Cargo type multipliers ───────────────────────────────────────────────────

CARGO_MULTIPLIER: dict[str, float] = {
    CargoType.general:       1.00,
    CargoType.agricultural:  1.00,
    CargoType.construction:  1.05,
    CargoType.livestock:     1.10,
    CargoType.electronics:   1.20,
    CargoType.refrigerated:  1.35,
    CargoType.hazardous:     1.60,
}

# ── Urgency multipliers ──────────────────────────────────────────────────────

_URGENCY: dict[str, float] = {
    "same_day":  1.50,
    "next_day":  1.20,
    "standard":  1.00,
    "flexible":  0.90,
}

# ── Seasonal demand factors by country and calendar month (1-indexed) ─────────
# Reflects East African harvest cycles, holiday import surges, construction seasons.

SEASONAL_FACTORS: dict[str, dict[int, float]] = {
    "KE": {1: 0.90, 2: 0.90, 3: 1.05, 4: 1.10, 5: 1.00, 6: 0.95,
           7: 1.10, 8: 1.10, 9: 1.05, 10: 1.10, 11: 1.15, 12: 1.20},
    "UG": {1: 0.90, 2: 0.90, 3: 1.05, 4: 1.10, 5: 1.00, 6: 0.95,
           7: 1.10, 8: 1.15, 9: 1.10, 10: 1.10, 11: 1.15, 12: 1.20},
    "TZ": {1: 0.90, 2: 0.90, 3: 1.00, 4: 1.05, 5: 1.00, 6: 0.95,
           7: 1.05, 8: 1.10, 9: 1.05, 10: 1.10, 11: 1.15, 12: 1.20},
}
_DEFAULT_SEASONAL: dict[int, float] = {m: 1.0 for m in range(1, 13)}

# ── In-memory demand index (refreshed every 30min by scheduler) ───────────────
# Maps corridor_key → demand_factor (0.80–1.30)
# Module-level dict so scheduler can write and endpoint can read without DB round-trip.
_DEMAND_INDEX: dict[str, float] = {}


def get_demand_factor(corridor_key: str) -> float:
    return _DEMAND_INDEX.get(corridor_key, _DEMAND_INDEX.get("default", 1.0))


def set_demand_index(index: dict[str, float]) -> None:
    """Called by scheduler to update the in-memory demand index."""
    _DEMAND_INDEX.clear()
    _DEMAND_INDEX.update(index)


def get_seasonal_factor(country_code: str) -> float:
    month = datetime.now(timezone.utc).month
    factors = SEASONAL_FACTORS.get(country_code.upper(), _DEFAULT_SEASONAL)
    return factors.get(month, 1.0)


# ── Corridor detection ───────────────────────────────────────────────────────

CORRIDOR_KEYWORDS: dict[str, list[str]] = {
    # Kenya
    "NBI": ["nairobi", "nrb", "westlands", "industrial area", "karen", "gigiri", "kilimani", "cbd", "mlolongo", "athi river"],
    "MBA": ["mombasa", "msa", "kilindini", "mvita", "likoni", "nyali", "bamburi", "port reitz"],
    "KSM": ["kisumu", "ksm", "kondele", "milimani"],
    "ELD": ["eldoret", "eld", "kapsabet", "nandi"],
    "NKR": ["nakuru", "nkr", "naivasha", "gilgil", "molo"],
    # Uganda
    "KLA": ["kampala", "kla", "entebbe", "uganda", "wakiso"],
    "JJA": ["jinja"],
    "GUL": ["gulu", "kitgum"],
    "MBR": ["mbarara", "ntungamo"],
    # Tanzania
    "DAR": ["dar es salaam", "dar", "dsm", "ilala", "temeke", "kinondoni"],
    "ARU": ["arusha", "moshi", "kilimanjaro"],
    "DOD": ["dodoma"],
    "MWZ": ["mwanza", "mara"],
}


def detect_corridor(pickup: str, dropoff: str) -> str:
    """
    Detect the standard corridor from pickup and dropoff location strings.
    Returns a sorted pair like "NBI-MBA" or "default" if no match.
    """
    p_lower = pickup.lower()
    d_lower = dropoff.lower()

    pickup_code: str | None = None
    dropoff_code: str | None = None

    for code, keywords in CORRIDOR_KEYWORDS.items():
        if any(kw in p_lower for kw in keywords):
            pickup_code = code
        if any(kw in d_lower for kw in keywords):
            dropoff_code = code

    if pickup_code and dropoff_code and pickup_code != dropoff_code:
        return "-".join(sorted([pickup_code, dropoff_code]))
    return "default"


# ── Distance and weight bands (used by scheduler for price intelligence) ─────

def _distance_band(km: float) -> str:
    if km < 100:   return "<100"
    if km < 300:   return "100-300"
    if km < 500:   return "300-500"
    return "500+"


def _weight_band(tonnes: float) -> str:
    if tonnes < 5:   return "<5t"
    if tonnes < 15:  return "5-15t"
    if tonnes < 30:  return "15-30t"
    return "30t+"


def _weight_multiplier(tonnes: float) -> float:
    if tonnes >= 30: return 1.15
    if tonnes >= 15: return 1.10
    if tonnes >= 5:  return 1.05
    return 1.00


def _tiered_fuel_surcharge(distance_km: float, service_type: str) -> float:
    """Distance-banded fuel surcharge in local currency units."""
    if service_type == VehicleServiceType.airfreight:
        return 0.0
    if service_type in (VehicleServiceType.parcel,):
        return 50.0
    # Trucks, vans, pickups, movers — scale with distance
    if distance_km < 100:   return 600.0
    if distance_km < 300:   return 1_200.0
    if distance_km < 500:   return 2_000.0
    return 2_800.0


# ── Core estimate function (synchronous, backwards compatible) ────────────────

@dataclass
class PriceEstimate:
    base_price_kes: float
    fuel_surcharge_kes: float
    total_price_kes: float
    platform_fee_kes: float
    owner_payout_kes: float
    vat_kes: float
    total_with_vat_kes: float
    breakdown: dict


def estimate_price(
    distance_km: float,
    service_type: str = VehicleServiceType.truck,
    cargo_type: str = CargoType.general,
    urgency: str = "standard",
    demand_factor: float = 1.0,
    commission_rate: float = 0.05,
    vat_rate: float = 0.0,
    # ── New optional params (all backwards compatible — default = neutral) ──
    base_rate_override: float | None = None,   # Overrides _FALLBACK_BASE_RATE
    weight_tonnes: float = 0.0,                # For weight multiplier
    fuel_adjustment_factor: float = 1.0,       # From FuelIndex table
    seasonal_factor: float = 1.0,              # From SEASONAL_FACTORS
) -> PriceEstimate:
    base_rate = base_rate_override if base_rate_override is not None else _FALLBACK_BASE_RATE.get(
        service_type, _FALLBACK_BASE_RATE[VehicleServiceType.truck]
    )
    cargo_mult   = CARGO_MULTIPLIER.get(cargo_type, 1.0)
    urgency_mult = _URGENCY.get(urgency, 1.0)
    weight_mult  = _weight_multiplier(weight_tonnes)
    fuel         = _tiered_fuel_surcharge(distance_km, service_type)
    minimum      = MINIMUM_PRICE.get(service_type, 500.0)

    base_price = (
        base_rate
        * distance_km
        * fuel_adjustment_factor
        * seasonal_factor
        * demand_factor
        * cargo_mult
        * urgency_mult
        * weight_mult
    )
    total = max(base_price + fuel, minimum)
    total = round(total, -2)  # round to nearest 100 KES

    platform_fee = round(total * commission_rate, 2)
    owner_payout = round(total - platform_fee, 2)
    vat_kes = round(total * vat_rate, 2)
    total_with_vat = round(total + vat_kes, 2)

    return PriceEstimate(
        base_price_kes=round(base_price, 2),
        fuel_surcharge_kes=fuel,
        total_price_kes=total,
        platform_fee_kes=platform_fee,
        owner_payout_kes=owner_payout,
        vat_kes=vat_kes,
        total_with_vat_kes=total_with_vat,
        breakdown={
            "distance_km":             distance_km,
            "base_rate_per_km":        base_rate,
            "cargo_multiplier":        cargo_mult,
            "urgency_multiplier":      urgency_mult,
            "weight_multiplier":       weight_mult,
            "weight_tonnes":           weight_tonnes,
            "fuel_adjustment_factor":  fuel_adjustment_factor,
            "seasonal_factor":         seasonal_factor,
            "demand_factor":           demand_factor,
            "fuel_surcharge_kes":      fuel,
            "commission_rate":         commission_rate,
            "vat_rate":                vat_rate,
            "vat_kes":                 vat_kes,
        },
    )


def suggest_min_bid(
    distance_km: float,
    service_type: str = VehicleServiceType.truck,
    cargo_type: str = CargoType.general,
) -> float:
    """Minimum acceptable bid floor for auction-mode loads (70% of standard price)."""
    est = estimate_price(distance_km, service_type, cargo_type)
    return round(est.total_price_kes * 0.70, -2)
