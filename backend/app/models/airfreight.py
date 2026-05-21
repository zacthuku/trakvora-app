import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Airfreight(Base):
    """
    Airfreight shipment — urgent and high-value cargo via air.
    """
    __tablename__ = "airfreight"

    shipper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Routing
    port_of_origin: Mapped[str] = mapped_column(String(100), nullable=False)     # e.g. "NBO - Nairobi JKIA"
    port_of_destination: Mapped[str] = mapped_column(String(100), nullable=False)
    airline: Mapped[str | None] = mapped_column(String(100), nullable=True)
    flight_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    expected_departure: Mapped[str | None] = mapped_column(String(30), nullable=True)  # ISO datetime string

    # AWB numbers
    hawb: Mapped[str | None] = mapped_column(String(50), nullable=True)   # House Air Waybill
    mawb: Mapped[str | None] = mapped_column(String(50), nullable=True)   # Master Air Waybill

    # Cargo
    cargo_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cargo_weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    volume_cbm: Mapped[float | None] = mapped_column(Float, nullable=True)
    declared_value_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_dangerous_goods: Mapped[bool | None] = mapped_column(nullable=True, default=False)
    iata_code: Mapped[str | None] = mapped_column(String(10), nullable=True)  # IATA dangerous goods class

    # Pricing & status
    price_kes: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    shipper  = relationship("User", foreign_keys=[shipper_id])
    provider = relationship("User", foreign_keys=[provider_id])
