"""Unit tests for app.services.pricing_service."""
import pytest

from app.services.pricing_service import PriceEstimate, estimate_price, suggest_min_bid


# ---------------------------------------------------------------------------
# estimate_price — return shape
# ---------------------------------------------------------------------------

def test_estimate_price_returns_price_estimate():
    result = estimate_price(distance_km=100)
    assert isinstance(result, PriceEstimate)


def test_estimate_price_has_all_fields():
    result = estimate_price(distance_km=100)
    assert result.base_price_kes >= 0
    assert result.total_price_kes > 0
    assert result.platform_fee_kes >= 0
    assert result.owner_payout_kes > 0
    assert result.vat_kes >= 0
    assert result.total_with_vat_kes >= result.total_price_kes
    assert isinstance(result.breakdown, dict)


def test_longer_distance_is_more_expensive():
    short = estimate_price(distance_km=50)
    long_ = estimate_price(distance_km=500)
    assert long_.total_price_kes > short.total_price_kes


def test_minimum_price_applied_for_short_distance():
    # 1 km trip — base would be 120 KES, but minimum for truck is 5000
    result = estimate_price(distance_km=1, service_type="truck")
    assert result.total_price_kes >= 5_000


def test_total_equals_base_plus_fuel_at_minimum():
    # With standard settings (no vat, 5% commission), payout + fee == total
    result = estimate_price(distance_km=200, commission_rate=0.05, vat_rate=0.0)
    assert abs(result.owner_payout_kes + result.platform_fee_kes - result.total_price_kes) < 1


def test_total_with_vat_is_correct():
    result = estimate_price(distance_km=200, commission_rate=0.05, vat_rate=0.16)
    expected = round(result.total_price_kes + result.vat_kes, 2)
    assert abs(result.total_with_vat_kes - expected) < 1


# ---------------------------------------------------------------------------
# Urgency multipliers
# ---------------------------------------------------------------------------

def test_same_day_more_expensive_than_standard():
    same = estimate_price(distance_km=100, urgency="same_day")
    std = estimate_price(distance_km=100, urgency="standard")
    assert same.total_price_kes > std.total_price_kes


def test_flexible_cheaper_than_standard():
    flex = estimate_price(distance_km=500, urgency="flexible")
    std = estimate_price(distance_km=500, urgency="standard")
    assert flex.total_price_kes <= std.total_price_kes


# ---------------------------------------------------------------------------
# Cargo multipliers
# ---------------------------------------------------------------------------

def test_hazardous_more_expensive_than_general():
    haz = estimate_price(distance_km=200, cargo_type="hazardous")
    gen = estimate_price(distance_km=200, cargo_type="general")
    assert haz.total_price_kes > gen.total_price_kes


# ---------------------------------------------------------------------------
# Demand factor
# ---------------------------------------------------------------------------

def test_demand_factor_scales_price():
    normal = estimate_price(distance_km=200, demand_factor=1.0)
    surge = estimate_price(distance_km=200, demand_factor=2.0)
    assert surge.total_price_kes > normal.total_price_kes


# ---------------------------------------------------------------------------
# suggest_min_bid
# ---------------------------------------------------------------------------

def test_suggest_min_bid_is_seventy_percent_of_estimate():
    bid_floor = suggest_min_bid(distance_km=200)
    full = estimate_price(distance_km=200)
    assert abs(bid_floor - round(full.total_price_kes * 0.70, -2)) < 200  # within 200 KES rounding
