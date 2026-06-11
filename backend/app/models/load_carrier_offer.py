import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CarrierOfferStatus(str, enum.Enum):
    pending   = "pending"
    accepted  = "accepted"
    rejected  = "rejected"
    cancelled = "cancelled"


class LoadCarrierOffer(Base):
    __tablename__ = "load_carrier_offers"
    __table_args__ = (UniqueConstraint("load_id", "user_id", name="uq_lco_load_user"),)

    load_id:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("loads.id", ondelete="CASCADE"), nullable=False)
    user_id:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status:       Mapped[CarrierOfferStatus] = mapped_column(
        Enum(CarrierOfferStatus, name="carrierofferstatus"),
        default=CarrierOfferStatus.pending,
        server_default="pending",
        nullable=False,
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    load = relationship("Load", back_populates="carrier_offers")
    user = relationship("User", foreign_keys=[user_id])
