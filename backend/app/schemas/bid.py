import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.bid import BidStatus


class BidCreate(BaseModel):
    load_id: uuid.UUID
    truck_id: uuid.UUID
    amount_kes: float = Field(..., gt=0)
    message: str | None = None


class BidOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    load_id: uuid.UUID
    owner_id: uuid.UUID
    truck_id: uuid.UUID
    amount_kes: float
    status: BidStatus
    message: str | None
    created_at: datetime
    # Bidder info (populated when owner relationship is loaded)
    bidder_name: str | None = None
    bidder_company: str | None = None
    bidder_rating: float | None = None
    # Truck info (populated when truck relationship is loaded)
    truck_is_verified: bool | None = None
    truck_registration: str | None = None
    truck_type_str: str | None = None
    truck_verification_score: float | None = None
    bidder_partner_tier: str | None = None


class BidStatusUpdate(BaseModel):
    status: BidStatus


class LoadSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    pickup_location: str
    dropoff_location: str
    cargo_type: str
    price_kes: float


class BidWithLoadOut(BidOut):
    load: LoadSummary
