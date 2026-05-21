import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ConsignmentNote(Base):
    __tablename__ = "consignment_notes"

    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"), unique=True, nullable=False)
    reference_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    cargo_details: Mapped[str] = mapped_column(Text, nullable=False)
    s3_url: Mapped[str | None] = mapped_column(String(500))
    shipper_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    driver_accepted: Mapped[bool] = mapped_column(Boolean, default=False)

    shipment = relationship("Shipment", foreign_keys=[shipment_id])
