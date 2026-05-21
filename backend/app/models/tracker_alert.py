import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AlertType(str, enum.Enum):
    no_ping          = "no_ping"
    duplicate_id     = "duplicate_id"
    tamper           = "tamper"
    low_battery      = "low_battery"
    signal_lost      = "signal_lost"
    unrealistic_jump = "unrealistic_jump"


class AlertSeverity(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"


class TrackerAlert(Base):
    __tablename__ = "tracker_alerts"

    tracker_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tracker_devices.id"), nullable=True, index=True
    )
    truck_id:  Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trucks.id"), nullable=True, index=True
    )
    alert_type: Mapped[AlertType]    = mapped_column(Enum(AlertType, native_enum=False), nullable=False)
    severity:   Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, native_enum=False), default=AlertSeverity.medium, nullable=False
    )
    message:     Mapped[str]             = mapped_column(Text, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    tracker_device = relationship("TrackerDevice", foreign_keys=[tracker_device_id])
    truck          = relationship("Truck",         foreign_keys=[truck_id])
    resolver       = relationship("User",          foreign_keys=[resolved_by])
