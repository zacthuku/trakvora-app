import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class NotificationType(str, enum.Enum):
    bid_received = "bid_received"
    bid_accepted = "bid_accepted"
    bid_rejected = "bid_rejected"
    shipment_booked = "shipment_booked"
    driver_en_route = "driver_en_route"
    cargo_loaded = "cargo_loaded"
    in_transit = "in_transit"
    delivered = "delivered"
    payment_released = "payment_released"
    dispute_opened = "dispute_opened"
    dispute_resolved = "dispute_resolved"
    consignment_signed = "consignment_signed"
    direct_offer = "direct_offer"
    direct_offer_response = "direct_offer_response"
    system = "system"


class Notification(Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reference_type: Mapped[str | None] = mapped_column(String(50))

    user = relationship("User", foreign_keys=[user_id])
