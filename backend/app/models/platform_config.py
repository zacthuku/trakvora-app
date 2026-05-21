import enum

from sqlalchemy import Boolean, Enum, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ServiceTier(str, enum.Enum):
    standard = "standard"
    premium = "premium"
    enterprise = "enterprise"


class PlatformConfig(Base):
    """
    One row per country+service_type combination.
    Seeded with defaults; overrideable per market.
    """
    __tablename__ = "platform_configs"

    country_code: Mapped[str] = mapped_column(String(2), nullable=False, default="KE")
    service_type: Mapped[str] = mapped_column(String(50), nullable=False, default="truck")
    commission_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)   # 5%
    vat_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.16)           # 16% VAT (Kenya)
    min_commission_kes: Mapped[float] = mapped_column(Float, nullable=False, default=500.0)
    max_commission_kes: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipper_commission_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    carrier_commission_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    cancellation_fee_rate:   Mapped[float | None] = mapped_column(Float, nullable=True)
