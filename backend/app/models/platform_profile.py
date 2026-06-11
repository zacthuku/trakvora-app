from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PlatformProfile(Base):
    """Single-row table (id=1) storing Trakvora's public company page content."""

    __tablename__ = "platform_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # Hero section
    tagline:  Mapped[str] = mapped_column(String(200), default="Built to move Africa's freight.")
    subtitle: Mapped[str] = mapped_column(
        Text,
        default=(
            "Trakvora is the operating system for freight in East Africa — "
            "connecting shippers, fleet owners, and drivers on one transparent, "
            "end-to-end logistics platform."
        ),
    )
    hq_city:      Mapped[str] = mapped_column(String(100), default="Nairobi, Kenya")
    founded_year: Mapped[int] = mapped_column(Integer, default=2026)

    # Stats strip
    stat_carriers:  Mapped[str] = mapped_column(String(20), default="3,000+")
    stat_countries: Mapped[str] = mapped_column(String(20), default="4")
    stat_shipments: Mapped[str] = mapped_column(String(20), default="50,000+")

    # Section visibility toggles (admin-controlled; thresholds enforced on frontend)
    show_stats_section:        Mapped[bool] = mapped_column(Boolean, default=False)
    show_testimonials_section: Mapped[bool] = mapped_column(Boolean, default=False)

    # Mission section
    mission_headline: Mapped[str] = mapped_column(
        String(200),
        default="Digitise freight so every cargo move is fast, fair, and traceable.",
    )
    mission_body: Mapped[str] = mapped_column(
        Text,
        default=(
            "Africa moves billions of dollars of cargo each year, yet most of it is still "
            "coordinated by phone, spreadsheet, and handshake. Trakvora replaces that with "
            "a real-time platform that gives every player — shipper, fleet owner, and driver "
            "— the tools and visibility they deserve.\n\n"
            "We believe that when logistics is transparent and efficient, the entire economy "
            "benefits. Better roads start with better data."
        ),
    )
