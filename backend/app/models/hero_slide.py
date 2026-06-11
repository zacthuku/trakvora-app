from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class HeroSlide(Base):
    __tablename__ = "hero_slides"

    headline:            Mapped[str]        = mapped_column(Text, nullable=False)
    highlight_word:      Mapped[str]        = mapped_column(String(100), nullable=False)
    description:         Mapped[str]        = mapped_column(Text, nullable=False)
    image_type:          Mapped[str]        = mapped_column(String(30), nullable=False, default="dispatch_os")
    cta_primary_text:    Mapped[str]        = mapped_column(String(100), nullable=False, default="Get Started")
    cta_primary_url:     Mapped[str]        = mapped_column(String(200), nullable=False, default="/register")
    cta_secondary_text:  Mapped[str | None] = mapped_column(String(100), nullable=True)
    cta_secondary_url:   Mapped[str | None] = mapped_column(String(200), nullable=True)
    sort_order:          Mapped[int]        = mapped_column(Integer, nullable=False, default=0)
    is_active:           Mapped[bool]       = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # null = global (all countries); "KE", "UG", "TZ" = country-specific
    country_code:        Mapped[str | None] = mapped_column(String(2), nullable=True, index=True)
