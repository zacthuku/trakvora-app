import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DeviceInventoryStatus(str, enum.Enum):
    installed  = "installed"
    warehouse  = "warehouse"
    damaged    = "damaged"
    returned   = "returned"
    retired    = "retired"


class TrackerDevice(Base):
    __tablename__ = "tracker_devices"

    serial_number:       Mapped[str]             = mapped_column(String(100), unique=True, nullable=False, index=True)
    imei:                Mapped[str | None]       = mapped_column(String(20), unique=True, nullable=True)
    firmware_version:    Mapped[str | None]       = mapped_column(String(50), nullable=True)
    status:              Mapped[DeviceInventoryStatus] = mapped_column(
        Enum(DeviceInventoryStatus, native_enum=False),
        default=DeviceInventoryStatus.warehouse,
        nullable=False,
    )

    # Assignment
    truck_id:      Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("trucks.id"),  nullable=True, index=True)
    installed_by:  Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"),   nullable=True)
    installed_at:  Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)

    # Telemetry snapshot (updated from GPS ping handler)
    signal_strength:    Mapped[int | None]   = mapped_column(Integer, nullable=True)   # dBm
    battery_level:      Mapped[float | None] = mapped_column(Float,   nullable=True)   # 0–100 %
    last_heartbeat_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Tamper
    tamper_flag:   Mapped[bool]        = mapped_column(Boolean, default=False, nullable=False)
    tamper_reason: Mapped[str | None]  = mapped_column(String(300), nullable=True)

    # Provisioning
    provisioning_secret: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provisioned_at:      Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    truck          = relationship("Truck", foreign_keys=[truck_id])
    installed_by_user = relationship("User", foreign_keys=[installed_by])
