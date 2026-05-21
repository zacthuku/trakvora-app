import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MoverProfile(Base):
    __tablename__ = "mover_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)

    service_areas:    Mapped[list | None] = mapped_column(JSON, nullable=True)   # ["Nairobi", "Mombasa"]
    fleet_size:       Mapped[int | None]  = mapped_column(Integer, nullable=True)
    services_offered: Mapped[list | None] = mapped_column(JSON, nullable=True)   # ["packing","storage","assembly"]
    license_number:   Mapped[str | None]  = mapped_column(String(100), nullable=True)
    insurance_number: Mapped[str | None]  = mapped_column(String(100), nullable=True)
    min_price_kes:    Mapped[float | None]= mapped_column(Float, nullable=True)
    bio:              Mapped[str | None]  = mapped_column(Text, nullable=True)
    is_verified:      Mapped[bool]        = mapped_column(Boolean, default=False)
    verified_at:      Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rating:           Mapped[float | None]= mapped_column(Float, nullable=True)
    total_jobs:       Mapped[int]         = mapped_column(Integer, default=0)

    user = relationship("User", foreign_keys=[user_id])


class AirFreightProfile(Base):
    __tablename__ = "air_freight_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)

    iata_agent_code:           Mapped[str | None]  = mapped_column(String(20), nullable=True)
    supported_routes:          Mapped[list | None]  = mapped_column(JSON, nullable=True)   # [{"from":"NBO","to":"LHR"}]
    supported_airlines:        Mapped[list | None]  = mapped_column(JSON, nullable=True)   # ["KQ","ET"]
    has_warehousing:           Mapped[bool]         = mapped_column(Boolean, default=False)
    has_customs_clearance:     Mapped[bool]         = mapped_column(Boolean, default=False)
    dangerous_goods_certified: Mapped[bool]         = mapped_column(Boolean, default=False)
    license_number:            Mapped[str | None]   = mapped_column(String(100), nullable=True)
    min_weight_kg:             Mapped[float | None] = mapped_column(Float, nullable=True)
    max_weight_kg:             Mapped[float | None] = mapped_column(Float, nullable=True)
    min_price_kes:             Mapped[float | None] = mapped_column(Float, nullable=True)
    bio:                       Mapped[str | None]   = mapped_column(Text, nullable=True)
    is_verified:               Mapped[bool]         = mapped_column(Boolean, default=False)
    verified_at:               Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rating:                    Mapped[float | None] = mapped_column(Float, nullable=True)
    total_jobs:                Mapped[int]          = mapped_column(Integer, default=0)

    user = relationship("User", foreign_keys=[user_id])


class ParcelCarrierProfile(Base):
    __tablename__ = "parcel_carrier_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)

    service_areas:  Mapped[list | None] = mapped_column(JSON, nullable=True)
    service_levels: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["standard","express","same_day"]
    max_weight_kg:  Mapped[float | None]= mapped_column(Float, nullable=True)
    has_cod:        Mapped[bool]        = mapped_column(Boolean, default=False)
    license_number: Mapped[str | None]  = mapped_column(String(100), nullable=True)
    min_price_kes:  Mapped[float | None]= mapped_column(Float, nullable=True)
    bio:            Mapped[str | None]  = mapped_column(Text, nullable=True)
    is_verified:    Mapped[bool]        = mapped_column(Boolean, default=False)
    verified_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rating:         Mapped[float | None]= mapped_column(Float, nullable=True)
    total_jobs:     Mapped[int]         = mapped_column(Integer, default=0)

    user = relationship("User", foreign_keys=[user_id])
