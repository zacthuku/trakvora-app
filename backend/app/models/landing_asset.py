from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LandingAsset(Base):
    __tablename__ = "landing_assets"

    key:       Mapped[str]  = mapped_column(String(100), nullable=False, unique=True, index=True)
    file_url:  Mapped[str]  = mapped_column(Text, nullable=False)
    alt_text:  Mapped[str]  = mapped_column(String(200), nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
