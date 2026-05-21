import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrackingSource(str, enum.Enum):
    driver_phone = "driver_phone"
    gps_tracker = "gps_tracker"


class TrackingPoint(Base):
    __tablename__ = "tracking_points"

    # truck is primary — telemetry belongs to the truck, not the shipment
    truck_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trucks.id"), nullable=False
    )
    # null during repositioning, yard moves, or maintenance runs
    shipment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shipments.id"), nullable=True
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    altitude: Mapped[float | None] = mapped_column(Float)           # metres — future-proofing
    source: Mapped[TrackingSource] = mapped_column(
        Enum(TrackingSource, name="trackingsource"), nullable=False
    )
    accuracy: Mapped[float | None] = mapped_column(Float)           # metres
    speed_kmh: Mapped[float | None] = mapped_column(Float)
    heading: Mapped[float | None] = mapped_column(Float)            # 0-360 degrees

    # device timestamp — may differ from created_at due to network buffering
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_tracking_points_truck_time", "truck_id", "recorded_at"),
        Index("ix_tracking_points_shipment_time", "shipment_id", "recorded_at"),
    )
