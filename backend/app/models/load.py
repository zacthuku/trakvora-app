import enum
import uuid

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.service_type import VehicleServiceType


class LoadStatus(str, enum.Enum):
    available = "available"
    bidding = "bidding"
    booked = "booked"
    en_route_pickup = "en_route_pickup"
    loaded = "loaded"
    in_transit = "in_transit"
    delivered = "delivered"
    cancelled = "cancelled"


class BookingMode(str, enum.Enum):
    fixed = "fixed"
    auction = "auction"
    direct = "direct"


class CargoType(str, enum.Enum):
    general = "general"
    refrigerated = "refrigerated"
    hazardous = "hazardous"
    livestock = "livestock"
    construction = "construction"
    agricultural = "agricultural"
    electronics = "electronics"


class Load(Base):
    __tablename__ = "loads"

    shipper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    pickup_location: Mapped[str] = mapped_column(String(255), nullable=False)
    pickup_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    dropoff_location: Mapped[str] = mapped_column(String(255), nullable=False)
    dropoff_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    dropoff_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    corridor: Mapped[str | None] = mapped_column(String(100))
    cargo_type: Mapped[CargoType] = mapped_column(Enum(CargoType), nullable=False)
    weight_tonnes: Mapped[float] = mapped_column(Float, nullable=False)
    volume_cbm: Mapped[float | None] = mapped_column(Float)
    cargo_description: Mapped[str | None] = mapped_column(Text)
    cargo_value_kes: Mapped[float | None] = mapped_column(Float)
    required_truck_type: Mapped[str | None] = mapped_column(String(50))
    price_kes: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    booking_mode: Mapped[BookingMode] = mapped_column(Enum(BookingMode), default=BookingMode.fixed)
    min_bid_floor_kes: Mapped[float | None] = mapped_column(Numeric(12, 2))
    status: Mapped[LoadStatus] = mapped_column(Enum(LoadStatus), default=LoadStatus.available)
    distance_km: Mapped[float | None] = mapped_column(Float)
    pickup_date: Mapped[str | None] = mapped_column(String(20))
    pickup_window: Mapped[str | None] = mapped_column(String(20))
    pickup_deadline: Mapped[str | None] = mapped_column(String(50))
    delivery_date: Mapped[str | None] = mapped_column(String(20))
    special_instructions: Mapped[str | None] = mapped_column(Text)
    requires_insurance: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    direct_offer_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    service_type: Mapped[VehicleServiceType] = mapped_column(
        Enum(VehicleServiceType, name="vehicleservicetype"),
        default=VehicleServiceType.truck,
        nullable=True,
    )

    shipper = relationship("User", foreign_keys=[shipper_id])
    direct_offer_user = relationship("User", foreign_keys=[direct_offer_user_id])

    @property
    def shipper_name(self) -> str | None:
        s = self.__dict__.get("shipper")
        return s.full_name if s else None

    @property
    def shipper_company(self) -> str | None:
        s = self.__dict__.get("shipper")
        return s.company_name if s else None
