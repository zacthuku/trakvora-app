from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PriceIntelligence(Base):
    __tablename__ = "price_intelligence"
    __table_args__ = (
        UniqueConstraint(
            "corridor_key", "cargo_type", "distance_band", "weight_band",
            name="uq_price_intelligence_bucket",
        ),
    )

    corridor_key:    Mapped[str]      = mapped_column(String(20), nullable=False, index=True)
    cargo_type:      Mapped[str]      = mapped_column(String(20), nullable=False)
    distance_band:   Mapped[str]      = mapped_column(String(10), nullable=False)
    weight_band:     Mapped[str]      = mapped_column(String(10), nullable=False)
    sample_count:    Mapped[int]      = mapped_column(Integer, nullable=False)
    p25_per_km:      Mapped[float]    = mapped_column(Float, nullable=False)
    p50_per_km:      Mapped[float]    = mapped_column(Float, nullable=False)
    p75_per_km:      Mapped[float]    = mapped_column(Float, nullable=False)
    avg_per_km:      Mapped[float]    = mapped_column(Float, nullable=False)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
