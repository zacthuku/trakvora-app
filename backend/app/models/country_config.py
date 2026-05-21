import uuid

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CountryConfig(Base):
    """
    Per-country operational configuration.
    One row per supported country. Seeded for KE, UG, TZ.
    """
    __tablename__ = "country_configs"

    country_code: Mapped[str] = mapped_column(String(2), unique=True, nullable=False)
    country_name: Mapped[str] = mapped_column(String(100), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="KES")
    currency_symbol: Mapped[str] = mapped_column(String(5), nullable=False, default="KSh")
    vat_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.16)
    distance_unit: Mapped[str] = mapped_column(String(5), nullable=False, default="km")
    date_format: Mapped[str] = mapped_column(String(20), nullable=False, default="DD/MM/YYYY")
    phone_prefix: Mapped[str] = mapped_column(String(5), nullable=False, default="+254")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Optional country-scoped admin user
    country_admin_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    country_admin = relationship("User", foreign_keys=[country_admin_user_id])
