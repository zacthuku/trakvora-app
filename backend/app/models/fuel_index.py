from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FuelIndex(Base):
    __tablename__ = "fuel_index"
    __table_args__ = (
        UniqueConstraint("country_code", name="uq_fuel_index_country"),
    )

    country_code:          Mapped[str]        = mapped_column(String(2),  nullable=False, index=True)
    baseline_price:        Mapped[float]      = mapped_column(Float, nullable=False)  # Diesel price at system launch
    current_price:         Mapped[float]      = mapped_column(Float, nullable=False)  # Latest fetched diesel price
    currency_code:         Mapped[str]        = mapped_column(String(3),  nullable=False)
    fuel_adjustment_factor:Mapped[float]      = mapped_column(Float, nullable=False, default=1.0)
    last_fetched_at:       Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_url:            Mapped[str | None] = mapped_column(Text, nullable=True)
    fetch_notes:           Mapped[str | None] = mapped_column(Text, nullable=True)
