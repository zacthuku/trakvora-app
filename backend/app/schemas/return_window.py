import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReturnWindowCreate(BaseModel):
    truck_id: uuid.UUID
    origin_location: str = Field(..., max_length=255)
    origin_latitude: float
    origin_longitude: float
    destination_location: str = Field(..., max_length=255)
    destination_latitude: float
    destination_longitude: float
    available_from: str
    available_until: str | None = None
    capacity_tonnes: float = Field(..., gt=0)
    notes: str | None = None


class ReturnWindowOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    driver_id: uuid.UUID
    truck_id: uuid.UUID
    origin_location: str
    origin_latitude: float
    origin_longitude: float
    destination_location: str
    destination_latitude: float
    destination_longitude: float
    available_from: str
    available_until: str | None
    capacity_tonnes: float
    notes: str | None
    is_active: bool
    created_at: datetime
