import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.load import LoadStatus


class ShipmentOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    load_id: uuid.UUID
    truck_id: uuid.UUID
    driver_id: uuid.UUID
    owner_id: uuid.UUID
    status: LoadStatus
    escrow_locked: bool
    escrow_released: bool
    pickup_photo_urls: str | None
    delivery_photo_urls: str | None
    current_latitude: float | None
    current_longitude: float | None
    eta: datetime | None
    delivered_at: datetime | None
    payment_confirmed_at: datetime | None
    dispute_open: bool
    dispute_reason: str | None = None
    dispute_opened_at: datetime | None = None
    dispute_note: str | None = None
    delivery_code: str | None = None
    shipper_rating: int | None = None
    carrier_rating: int | None = None
    shipper_rating_comment: str | None = None
    carrier_rating_comment: str | None = None
    created_at: datetime
    pod_signature_url:  str | None = None
    delivery_latitude:  float | None = None
    delivery_longitude: float | None = None
    payment_mode:                str | None = "direct"
    direct_payment_confirmed_at: datetime | None = None
    delivery_location_name: str | None = None
    auto_delivered_at: datetime | None = None
    delivery_method: str | None = None
    share_token: str | None = None


class ShipmentStatusUpdate(BaseModel):
    status: LoadStatus
    pickup_photo_urls: str | None = None
    delivery_photo_urls: str | None = None
    delivery_code: str | None = None
    pod_signature_url:  str | None = None   # base64 PNG data URL or S3 URL after upload
    delivery_latitude:  float | None = None
    delivery_longitude: float | None = None
    no_photo_reason:    str | None = None   # e.g. "no_smartphone", "camera_fault" — waives photo requirement


class ConfirmDeliveryIn(BaseModel):
    shipper_pod_urls: str | None = None  # comma-separated URLs; provided when driver had no phone


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    eta: datetime | None = None
    accuracy: float | None = None    # metres from GPS sensor
    speed_kmh: float | None = None
    heading: float | None = None     # 0-360 degrees


class PublicShipmentSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    load_id: uuid.UUID
    status: LoadStatus
    current_latitude: float | None
    current_longitude: float | None
    eta: datetime | None
    delivered_at: datetime | None
    delivery_code: str | None = None
    delivery_method: str | None = None
    payment_confirmed_at: datetime | None = None


class CustomerConfirmDeliveryIn(BaseModel):
    share_token: str
    delivery_code: str


class ShipmentContactOut(BaseModel):
    shipper_name: str | None = None
    shipper_company: str | None = None
    shipper_phone: str | None = None
    carrier_name: str | None = None
    carrier_company: str | None = None
    carrier_phone: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None


class ConsignmentNoteOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    shipment_id: uuid.UUID
    reference_number: str
    cargo_details: str
    s3_url: str | None
    shipper_accepted: bool
    owner_accepted: bool
    driver_accepted: bool
    created_at: datetime
