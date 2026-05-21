import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MoveRequest(Base):
    """
    Home / office relocation request (Movers service type).
    """
    __tablename__ = "move_requests"

    shipper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Locations
    origin_location: Mapped[str] = mapped_column(String(255), nullable=False)
    origin_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    origin_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    origin_floor: Mapped[int] = mapped_column(Integer, default=0)
    origin_has_lift: Mapped[bool] = mapped_column(Boolean, default=False)

    destination_location: Mapped[str] = mapped_column(String(255), nullable=False)
    destination_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    destination_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    destination_floor: Mapped[int] = mapped_column(Integer, default=0)
    destination_has_lift: Mapped[bool] = mapped_column(Boolean, default=False)

    # Move details
    move_date: Mapped[str | None] = mapped_column(String(20), nullable=True)       # ISO date string
    move_type: Mapped[str] = mapped_column(String(50), default="home")             # home | office | storage
    num_rooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_volume_cbm: Mapped[float | None] = mapped_column(Float, nullable=True)
    requires_packing: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_storage: Mapped[bool] = mapped_column(Boolean, default=False)

    # Inventory (free-form JSONB list: [{item, quantity, fragile}])
    inventory_items: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_kes: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")

    provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    shipper  = relationship("User", foreign_keys=[shipper_id])
    provider = relationship("User", foreign_keys=[provider_id])
