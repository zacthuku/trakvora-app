import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.truck import TruckType


class TruckCreate(BaseModel):
    registration_number: str = Field(..., max_length=20)
    truck_type: TruckType
    capacity_tonnes: float = Field(..., gt=0)
    make: str | None = None
    model: str | None = None
    year: int | None = None
    gps_tracker_id: str | None = None
    is_driver_owned: bool = False


class TruckUpdate(BaseModel):
    truck_type: TruckType | None = None
    capacity_tonnes: float | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = None
    gps_tracker_id: str | None = None
    is_active: bool | None = None


class TruckOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    owner_id: uuid.UUID
    registration_number: str
    truck_type: TruckType
    capacity_tonnes: float
    make: str | None
    model: str | None
    year: int | None
    gps_tracker_id: str | None
    is_active: bool
    is_verified: bool
    verification_score: float | None
    inspection_status: str | None
    is_driver_owned: bool
    assigned_driver_id: uuid.UUID | None
    current_latitude: float | None
    current_longitude: float | None
    created_at: datetime


class PublicTruckOut(BaseModel):
    id: uuid.UUID
    registration_number: str
    truck_type: TruckType
    capacity_tonnes: float
    make: str | None
    model: str | None
    is_active: bool
    owner_name: str
    owner_rating: float
    owner_trips: int
    owner_verified: bool
    truck_verified: bool = False
    verification_score: float | None = None
    inspection_status: str | None = None
