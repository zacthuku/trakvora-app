"""
Dynamic pricing engine.

Formula:
  price = base_rate_per_km × distance_km × cargo_multiplier × urgency_multiplier × demand_factor
  + fuel_surcharge_flat

All rates in KES. Defaults reflect typical East African road freight rates.
"""
from dataclasses import dataclass

from app.models.load import CargoType
from app.models.service_type import VehicleServiceType


# ── Base rates (KES per km) per service type ────────────────────────────────

BASE_RATE_PER_KM: dict[str, float] = {
    VehicleServiceType.truck:       120.0,
    VehicleServiceType.van:          55.0,
    VehicleServiceType.pickup:       40.0,
    VehicleServiceType.parcel:       25.0,
    VehicleServiceType.movers:       80.0,
    VehicleServiceType.airfreight: 1200.0,  # per km great-circle, very approximate
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

URGENCY_SAME_DAY  = 1.50
URGENCY_NEXT_DAY  = 1.20
URGENCY_STANDARD  = 1.00
URGENCY_FLEXIBLE  = 0.90

# ── Fuel surcharge (flat KES, updated periodically) ─────────────────────────

FUEL_SURCHARGE_KES: dict[str, float] = {
    VehicleServiceType.truck:       800.0,
    VehicleServiceType.van:         300.0,
    VehicleServiceType.pickup:      200.0,
    VehicleServiceType.parcel:       50.0,
    VehicleServiceType.movers:      400.0,
    VehicleServiceType.airfreight:    0.0,  # baked into airfreight rate
}


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
) -> PriceEstimate:
    """
    Estimate a fair market price for a load.

    Args:
        distance_km: Road distance in kilometres.
        service_type: VehicleServiceType value.
        cargo_type: CargoType value.
        urgency: 'same_day' | 'next_day' | 'standard' | 'flexible'
        demand_factor: Real-time demand scalar (1.0 = normal, >1 = surge).
        commission_rate: Platform commission fraction (0.05 = 5%).

    Returns:
        PriceEstimate with full breakdown.
    """
    base_rate = BASE_RATE_PER_KM.get(service_type, BASE_RATE_PER_KM[VehicleServiceType.truck])
    cargo_mult = CARGO_MULTIPLIER.get(cargo_type, 1.0)
    urgency_mult = {
        "same_day":  URGENCY_SAME_DAY,
        "next_day":  URGENCY_NEXT_DAY,
        "standard":  URGENCY_STANDARD,
        "flexible":  URGENCY_FLEXIBLE,
    }.get(urgency, URGENCY_STANDARD)

    fuel = FUEL_SURCHARGE_KES.get(service_type, 0.0)
    minimum = MINIMUM_PRICE.get(service_type, 500.0)

    base_price = base_rate * distance_km * cargo_mult * urgency_mult * demand_factor
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
            "distance_km": distance_km,
            "base_rate_per_km": base_rate,
            "cargo_multiplier": cargo_mult,
            "urgency_multiplier": urgency_mult,
            "demand_factor": demand_factor,
            "fuel_surcharge_kes": fuel,
            "commission_rate": commission_rate,
            "vat_rate": vat_rate,
            "vat_kes": vat_kes,
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
