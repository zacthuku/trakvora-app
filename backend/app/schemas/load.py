import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel, Field, field_validator

from app.models.load import BookingMode, CargoType, LoadPaymentMode, LoadStatus, LoadVisibility, TerrainDifficulty


class LoadCreate(BaseModel):
    pickup_location: str = Field(..., max_length=255)
    pickup_latitude: float
    pickup_longitude: float
    dropoff_location: str = Field(..., max_length=255)
    dropoff_latitude: float
    dropoff_longitude: float
    cargo_type: CargoType
    weight_tonnes: float = Field(..., gt=0)
    volume_cbm: float | None = None
    cargo_description: str | None = None
    cargo_value_kes: float | None = None
    required_truck_type: str | None = None
    price_kes: float = Field(..., gt=0)
    booking_mode: BookingMode = BookingMode.fixed
    min_bid_floor_kes: float | None = None
    distance_km: float | None = None
    pickup_date: str | None = None
    pickup_window: str | None = None
    pickup_deadline: str | None = None
    delivery_date: str | None = None
    special_instructions: str | None = None
    requires_insurance: bool = False
    direct_offer_user_id: uuid.UUID | None = None
    direct_offer_user_ids: List[uuid.UUID] | None = None  # blast to up to 5 carriers simultaneously
    scheduled_at: datetime | None = None  # defer publishing to this UTC time
    terrain_difficulty: TerrainDifficulty = TerrainDifficulty.standard
    payment_mode: LoadPaymentMode = LoadPaymentMode.direct
    visibility: LoadVisibility = LoadVisibility.public
    unattended_delivery: bool = False
    is_urgent: bool = False

    @field_validator("direct_offer_user_ids")
    @classmethod
    def check_max_carriers(cls, v):
        if v is not None and len(v) > 5:
            raise ValueError("Cannot send a direct offer to more than 5 carriers at once")
        return v


class LoadUpdate(BaseModel):
    pickup_deadline: str | None = None
    delivery_date: str | None = None
    special_instructions: str | None = None
    price_kes: float | None = None
    status: LoadStatus | None = None


class ReOfferRequest(BaseModel):
    user_ids: List[uuid.UUID] = Field(..., min_length=1, max_length=5)
    price_kes: float | None = Field(None, gt=0)


class LoadOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    shipper_id: uuid.UUID
    pickup_location: str
    pickup_latitude: float
    pickup_longitude: float
    dropoff_location: str
    dropoff_latitude: float
    dropoff_longitude: float
    corridor: str | None
    cargo_type: CargoType
    weight_tonnes: float
    volume_cbm: float | None
    cargo_description: str | None
    cargo_value_kes: float | None
    required_truck_type: str | None
    price_kes: float
    booking_mode: BookingMode
    min_bid_floor_kes: float | None
    status: LoadStatus
    distance_km: float | None
    pickup_date: str | None
    pickup_window: str | None
    pickup_deadline: str | None
    delivery_date: str | None = None
    special_instructions: str | None
    requires_insurance: bool = False
    direct_offer_user_id: uuid.UUID | None = None
    created_at: datetime
    shipper_name: str | None = None
    shipper_company: str | None = None
    scheduled_at: datetime | None = None
    terrain_difficulty: TerrainDifficulty = TerrainDifficulty.standard
    payment_mode: LoadPaymentMode = LoadPaymentMode.direct
    visibility: LoadVisibility = LoadVisibility.public
    unattended_delivery: bool = False
    is_urgent: bool = False
    all_offers_declined: bool = False

    @field_validator("requires_insurance", mode="before")
    @classmethod
    def coerce_none_to_false(cls, v):
        return bool(v) if v is not None else False


class LoadListOut(BaseModel):
    model_config = {"from_attributes": True}

    items: list[LoadOut]
    total: int
    page: int
    page_size: int


class PublicLoadOut(BaseModel):
    id: uuid.UUID
    pickup_location: str
    dropoff_location: str
    corridor: str | None
    cargo_type: CargoType
    weight_tonnes: float
    required_truck_type: str | None
    price_kes: float
    distance_km: float | None
    pickup_date: str | None
    created_at: datetime
    bid_count: int = 0
    shipper_name: str | None = None
    shipper_company: str | None = None
    is_urgent: bool = False
