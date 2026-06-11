import secrets
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.load import LoadStatus


class Shipment(Base):
    __tablename__ = "shipments"

    load_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("loads.id"), unique=True, nullable=False)
    truck_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trucks.id"), nullable=False)
    driver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[LoadStatus] = mapped_column(default=LoadStatus.booked)
    escrow_locked: Mapped[bool] = mapped_column(default=False)
    escrow_released: Mapped[bool] = mapped_column(default=False)
    pickup_photo_urls: Mapped[str | None] = mapped_column(String(2000))
    delivery_photo_urls: Mapped[str | None] = mapped_column(String(2000))
    current_latitude: Mapped[float | None] = mapped_column(Float)
    current_longitude: Mapped[float | None] = mapped_column(Float)
    eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispute_open: Mapped[bool] = mapped_column(default=False)
    dispute_reason: Mapped[str | None] = mapped_column(Text)
    dispute_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispute_note: Mapped[str | None] = mapped_column(Text)
    delivery_code: Mapped[str | None] = mapped_column(String(10))
    shipper_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    carrier_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shipper_rating_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    carrier_rating_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # POD (Proof of Delivery) enriched fields — added in migration 0039
    pod_signature_url:  Mapped[str | None] = mapped_column(String(500), nullable=True)
    delivery_latitude:  Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Unattended delivery GPS stamp fields — added in migration 0054
    delivery_location_name: Mapped[str | None] = mapped_column(String(480), nullable=True)
    auto_delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_method: Mapped[str | None] = mapped_column(String(20), nullable=True)  # attended | unattended_gps | auto_tracker

    # Payment mode mirrors Load.payment_mode at booking time
    payment_mode: Mapped[str] = mapped_column(String(10), nullable=False, default="direct", server_default="direct")
    # Set when shipper confirms direct payment to trucker (direct mode only)
    direct_payment_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Shareable tracking link token — generated on creation, never changes
    share_token: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True,
        default=lambda: secrets.token_urlsafe(24),
    )

    load = relationship("Load", foreign_keys=[load_id])
    truck = relationship("Truck", foreign_keys=[truck_id])
    driver = relationship("User", foreign_keys=[driver_id])
    owner = relationship("User", foreign_keys=[owner_id])
