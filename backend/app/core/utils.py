import math
from datetime import datetime, timedelta, timezone


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_eta(distance_km: float, avg_speed_kmh: float = 60.0) -> datetime:
    hours = distance_km / avg_speed_kmh
    return datetime.now(timezone.utc) + timedelta(hours=hours)


_CORRIDOR_CENTROIDS = {
    "Nairobi-Mombasa": (-1.2921, 36.8219, -4.0435, 39.6682),
    "Nairobi-Kampala": (-1.2921, 36.8219, 0.3476, 32.5825),
    "Nairobi-Dar": (-1.2921, 36.8219, -6.7924, 39.2083),
    "Mombasa-Kampala": (-4.0435, 39.6682, 0.3476, 32.5825),
}


def detect_corridor(
    pickup_lat: float,
    pickup_lon: float,
    dropoff_lat: float,
    dropoff_lon: float,
) -> str | None:
    best_name = None
    best_score = float("inf")
    for name, (p1_lat, p1_lon, p2_lat, p2_lon) in _CORRIDOR_CENTROIDS.items():
        score = haversine_km(pickup_lat, pickup_lon, p1_lat, p1_lon) + haversine_km(
            dropoff_lat, dropoff_lon, p2_lat, p2_lon
        )
        reverse = haversine_km(pickup_lat, pickup_lon, p2_lat, p2_lon) + haversine_km(
            dropoff_lat, dropoff_lon, p1_lat, p1_lon
        )
        score = min(score, reverse)
        if score < best_score:
            best_score = score
            best_name = name
    return best_name if best_score < 200 else None
