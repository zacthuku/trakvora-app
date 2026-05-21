import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TrackingPingRequest(BaseModel):
    tracker_id: str
    latitude: float
    longitude: float
    accuracy: float | None = None
    speed_kmh: float | None = None
    heading: float | None = None
    altitude: float | None = None
    timestamp: datetime | None = None   # device time; falls back to server time
    battery: float | None = None        # 0-100 %
    signal: int | None = None           # dBm


class TrackingPingResponse(BaseModel):
    status: str
    shipment_id: str | None


class TrackingPointOut(BaseModel):
    model_config = {"from_attributes": True, "populate_by_name": True}

    lat: float = Field(alias="latitude")
    lng: float = Field(alias="longitude")
    recorded_at: datetime
    source: str
    speed_kmh: float | None = None
    heading: float | None = None


class TrackingTrailOut(BaseModel):
    shipment_id: str | None
    truck_id: str
    points: list[TrackingPointOut]
