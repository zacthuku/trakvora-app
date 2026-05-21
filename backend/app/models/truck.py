import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.service_type import VehicleServiceType


class InspectionStatus(str, enum.Enum):
    not_requested = "not_requested"
    pending       = "pending"
    in_progress   = "in_progress"
    submitted     = "submitted"
    approved      = "approved"
    rejected      = "rejected"
    re_inspection = "re_inspection"


class TruckType(str, enum.Enum):
    flatbed = "flatbed"
    dry_van = "dry_van"
    reefer = "reefer"
    tanker = "tanker"
    lowbed = "lowbed"
    tipper = "tipper"
    # Multi-modal additions
    van = "van"
    pickup = "pickup"
    motorcycle_courier = "motorcycle_courier"
    cargo_bike = "cargo_bike"


class Truck(Base):
    __tablename__ = "trucks"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    truck_type: Mapped[TruckType] = mapped_column(Enum(TruckType), nullable=False)
    capacity_tonnes: Mapped[float] = mapped_column(Float, nullable=False)
    make: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    year: Mapped[int | None] = mapped_column(Integer)
    gps_tracker_id: Mapped[str | None] = mapped_column(String(100))
    tracker_secret: Mapped[str | None] = mapped_column(String(64))
    last_ping_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_ping_ip: Mapped[str | None] = mapped_column(String(45))       # IPv4 or IPv6
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    battery_level: Mapped[float | None] = mapped_column(Float)          # 0–100 %
    signal_strength: Mapped[int | None] = mapped_column(Integer)        # dBm
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    current_latitude: Mapped[float | None] = mapped_column(Float)
    current_longitude: Mapped[float | None] = mapped_column(Float)
    is_driver_owned: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_driver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    inspection_status: Mapped[InspectionStatus] = mapped_column(
        Enum(InspectionStatus, name="inspectionstatus"),
        default=InspectionStatus.not_requested,
    )
    service_type: Mapped[VehicleServiceType] = mapped_column(
        Enum(VehicleServiceType, name="vehicleservicetype"),
        default=VehicleServiceType.truck,
        nullable=True,
    )

    owner = relationship("User", foreign_keys=[owner_id])
    assigned_driver = relationship("Driver", foreign_keys=[assigned_driver_id])
