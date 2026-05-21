import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class VehicleCondition(str, enum.Enum):
    clean = "clean"
    good  = "good"
    fair  = "fair"
    poor  = "poor"


class TrackerStatus(str, enum.Enum):
    not_installed = "not_installed"
    installed     = "installed"
    verified      = "verified"


class VehicleInspection(Base):
    __tablename__ = "vehicle_inspections"

    task_id:          Mapped[uuid.UUID]              = mapped_column(UUID(as_uuid=True), ForeignKey("inspection_tasks.id"), nullable=False)
    inspector_id:     Mapped[uuid.UUID]              = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    truck_id:         Mapped[uuid.UUID]              = mapped_column(UUID(as_uuid=True), ForeignKey("trucks.id"), nullable=False)
    photo_urls:       Mapped[dict | None]            = mapped_column(JSONB, nullable=True)
    driver_photo_url: Mapped[str | None]             = mapped_column(String(500))
    condition:        Mapped[VehicleCondition | None] = mapped_column(Enum(VehicleCondition, name="vehiclecondition"), nullable=True)
    score:            Mapped[int | None]             = mapped_column(Integer)
    damages:          Mapped[str | None]             = mapped_column(Text)
    roadworthy:       Mapped[bool | None]            = mapped_column(Boolean)
    tracker_status:   Mapped[TrackerStatus]          = mapped_column(
        Enum(TrackerStatus, name="trackerstatus"),
        default=TrackerStatus.not_installed,
    )
    tracker_id:     Mapped[str | None]   = mapped_column(String(100))
    notes:          Mapped[str | None]   = mapped_column(Text)
    checklist:      Mapped[dict | None]  = mapped_column(JSON, nullable=True)
    submitted_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    inspection_lat: Mapped[float | None] = mapped_column(Float)
    inspection_lon: Mapped[float | None] = mapped_column(Float)

    task      = relationship("InspectionTask", foreign_keys=[task_id])
    inspector = relationship("User",           foreign_keys=[inspector_id])
    truck     = relationship("Truck",          foreign_keys=[truck_id])
