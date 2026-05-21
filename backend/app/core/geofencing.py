"""
Geofencing utilities for pickup/dropoff zone validation and route deviation detection.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class Zone:
    lat: float
    lon: float
    radius_km: float
    name: str = ""


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_in_zone(lat: float, lon: float, zone: Zone) -> bool:
    """Return True if the point is within the zone radius."""
    return haversine_km(lat, lon, zone.lat, zone.lon) <= zone.radius_km


def validate_pickup_arrival(
    driver_lat: float,
    driver_lon: float,
    pickup_lat: float,
    pickup_lon: float,
    radius_km: float = 0.5,
) -> bool:
    """Driver must be within radius_km of the pickup point to mark cargo as loaded."""
    zone = Zone(lat=pickup_lat, lon=pickup_lon, radius_km=radius_km, name="pickup")
    return is_in_zone(driver_lat, driver_lon, zone)


def validate_delivery_arrival(
    driver_lat: float,
    driver_lon: float,
    dropoff_lat: float,
    dropoff_lon: float,
    radius_km: float = 0.5,
) -> bool:
    """Driver must be within radius_km of the dropoff point to mark as delivered."""
    zone = Zone(lat=dropoff_lat, lon=dropoff_lon, radius_km=radius_km, name="dropoff")
    return is_in_zone(driver_lat, driver_lon, zone)


def detect_route_deviation(
    current_lat: float,
    current_lon: float,
    origin_lat: float,
    origin_lon: float,
    destination_lat: float,
    destination_lon: float,
    max_deviation_km: float = 30.0,
) -> tuple[bool, float]:
    """
    Detect if a driver has deviated significantly from the origin→destination corridor.

    Uses the cross-track distance (perpendicular distance from the great-circle path).
    Returns (is_deviation, cross_track_km).
    """
    cross_track_km = _cross_track_distance(
        current_lat, current_lon,
        origin_lat, origin_lon,
        destination_lat, destination_lon,
    )
    return cross_track_km > max_deviation_km, round(cross_track_km, 2)


def _cross_track_distance(
    point_lat: float, point_lon: float,
    start_lat: float, start_lon: float,
    end_lat: float, end_lon: float,
) -> float:
    """Great-circle cross-track distance in km."""
    R = 6371.0
    d13 = haversine_km(start_lat, start_lon, point_lat, point_lon) / R

    bearing_13 = _bearing(start_lat, start_lon, point_lat, point_lon)
    bearing_12 = _bearing(start_lat, start_lon, end_lat, end_lon)

    dxt = math.asin(math.sin(d13) * math.sin(math.radians(bearing_13 - bearing_12)))
    return abs(dxt * R)


def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    x = math.sin(dlam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)
    return math.degrees(math.atan2(x, y))


def estimate_eta_minutes(
    current_lat: float,
    current_lon: float,
    destination_lat: float,
    destination_lon: float,
    avg_speed_kmh: float = 60.0,
) -> int:
    """Simple straight-line ETA estimate. Use route service for road-based ETA."""
    dist = haversine_km(current_lat, current_lon, destination_lat, destination_lon)
    road_factor = 1.35  # typical road vs straight-line factor
    return int((dist * road_factor / avg_speed_kmh) * 60)
