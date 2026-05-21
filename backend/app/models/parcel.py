import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ParcelServiceLevel(str, enum.Enum):
    standard = "standard"   # 2–5 days
    express = "express"     # next day
    same_day = "same_day"   # within hours


class Parcel(Base):
    """
    Lightweight parcel shipment — on-demand and scheduled delivery.
    Linked to the load that covers the route; adds parcel-specific fields.
    """
    __tablename__ = "parcels"

    shipper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    pickup_location: Mapped[str] = mapped_column(String(255), nullable=False)
    pickup_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    dropoff_location: Mapped[str] = mapped_column(String(255), nullable=False)
    dropoff_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    dropoff_longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # Parcel dimensions
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    length_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    width_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Content & insurance
    contents_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    declared_value_kes: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_fragile: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_insurance: Mapped[bool] = mapped_column(Boolean, default=False)

    # Delivery
    service_level: Mapped[ParcelServiceLevel] = mapped_column(
        Enum(ParcelServiceLevel, name="parcelservicelevel"),
        default=ParcelServiceLevel.standard,
    )
    recipient_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    recipient_phone: Mapped[str | None] = mapped_column(String(25), nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing
    price_kes: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")

    carrier_id:  Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    accepted_at: Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)

    shipper = relationship("User", foreign_keys=[shipper_id])
    carrier = relationship("User", foreign_keys=[carrier_id])
