import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ReturnWindow(Base):
    __tablename__ = "return_windows"

    driver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    truck_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trucks.id"), nullable=False)
    origin_location: Mapped[str] = mapped_column(String(255), nullable=False)
    origin_latitude: Mapped[float] = mapped_column(nullable=False)
    origin_longitude: Mapped[float] = mapped_column(nullable=False)
    destination_location: Mapped[str] = mapped_column(String(255), nullable=False)
    destination_latitude: Mapped[float] = mapped_column(nullable=False)
    destination_longitude: Mapped[float] = mapped_column(nullable=False)
    available_from: Mapped[str] = mapped_column(String(50), nullable=False)
    available_until: Mapped[str | None] = mapped_column(String(50))
    capacity_tonnes: Mapped[float] = mapped_column(nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    driver = relationship("User", foreign_keys=[driver_id])
    truck = relationship("Truck", foreign_keys=[truck_id])
