import uuid
from datetime import date, datetime
from typing import Literal

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


class TruckDocumentSubmit(BaseModel):
    """Owner/driver submits compliance documents for admin review."""
    logbook_url: str | None = None
    insurance_url: str | None = None
    insurance_expiry: date | None = None
    ntsa_inspection_url: str | None = None
    ntsa_inspection_expiry: date | None = None


class AdminTruckVerifyAction(BaseModel):
    """Admin approves or rejects a truck after reviewing submitted documents."""
    action: Literal["approve", "reject"]
    verification_score: float | None = None   # 0–100, used on approve
    rejection_reason: str | None = None       # required on reject


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
    verified_at: datetime | None = None
    verification_score: float | None
    inspection_status: str | None
    verification_notes: str | None = None
    # NTSA automated plate check
    reg_check_status: str = "unverified"
    reg_check_at: datetime | None = None
    reg_check_detail: str | None = None
    reg_check_owner: str | None = None
    is_driver_owned: bool
    assigned_driver_id: uuid.UUID | None
    current_latitude: float | None
    current_longitude: float | None
    # Compliance documents
    logbook_url: str | None = None
    insurance_url: str | None = None
    insurance_expiry: date | None = None
    ntsa_inspection_url: str | None = None
    ntsa_inspection_expiry: date | None = None
    created_at: datetime


class NearbyTruckOut(BaseModel):
    truck_id: uuid.UUID
    owner_id: uuid.UUID
    owner_name: str | None
    owner_rating: float
    owner_total_trips: int
    truck_type: str
    capacity_tonnes: float
    make: str | None
    model: str | None
    current_latitude: float
    current_longitude: float
    distance_km: float
    score: float


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
    current_latitude: float | None = None
    current_longitude: float | None = None
    last_seen_at: datetime | None = None
