"""Scheduled report subscription model."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ReportFrequency(str, enum.Enum):
    daily  = "daily"
    weekly = "weekly"


class ReportType(str, enum.Enum):
    fleet      = "fleet"
    shipments  = "shipments"
    analytics  = "analytics"


class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    report_type: Mapped[str]            = mapped_column(String(50), nullable=False)
    frequency:   Mapped[ReportFrequency] = mapped_column(
        Enum(ReportFrequency, native_enum=False), nullable=False, default=ReportFrequency.weekly
    )
    email_to: Mapped[str | None] = mapped_column(String(255), nullable=True)  # override recipient
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
