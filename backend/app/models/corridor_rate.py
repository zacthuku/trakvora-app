import uuid

from sqlalchemy import Boolean, Float, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CorridorRate(Base):
    __tablename__ = "corridor_rates"
    __table_args__ = (
        UniqueConstraint("country_code", "corridor_key", name="uq_corridor_rate_country_corridor"),
    )

    country_code:  Mapped[str]        = mapped_column(String(2),  nullable=False, index=True)
    corridor_key:  Mapped[str]        = mapped_column(String(20), nullable=False)
    corridor_name: Mapped[str]        = mapped_column(String(100), nullable=False)
    base_rate:     Mapped[float]      = mapped_column(Float, nullable=False)
    is_active:     Mapped[bool]       = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    notes:         Mapped[str | None] = mapped_column(Text, nullable=True)
