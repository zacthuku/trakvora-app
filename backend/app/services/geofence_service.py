"""
Geofence helpers — rideshare-style arrival detection for Trakvora.

Used in the device ping handler to automatically detect when a truck is
approaching a pickup or dropoff point and trigger notifications.
"""
from __future__ import annotations

import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Return the great-circle distance in kilometres between two GPS coordinates.
    Uses the Haversine formula — accurate to within ~0.5% for distances < 500 km.
    """
    R = 6371.0  # Earth's mean radius in km

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Radius thresholds (kilometres)
ARRIVING_RADIUS_KM   = 0.5    # 500 m  — "driver is arriving" alert
ARRIVED_RADIUS_KM    = 0.15   # 150 m  — considered at location


def is_arriving(truck_lat: float, truck_lng: float,
                dest_lat: float, dest_lng: float) -> bool:
    """True when truck is within ARRIVING_RADIUS_KM of destination."""
    if None in (truck_lat, truck_lng, dest_lat, dest_lng):
        return False
    return haversine_km(truck_lat, truck_lng, dest_lat, dest_lng) <= ARRIVING_RADIUS_KM


def is_at_location(truck_lat: float, truck_lng: float,
                   dest_lat: float, dest_lng: float) -> bool:
    """True when truck is within ARRIVED_RADIUS_KM of destination (very close)."""
    if None in (truck_lat, truck_lng, dest_lat, dest_lng):
        return False
    return haversine_km(truck_lat, truck_lng, dest_lat, dest_lng) <= ARRIVED_RADIUS_KM
