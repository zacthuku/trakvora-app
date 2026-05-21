import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ReviewDecision(str, enum.Enum):
    approved      = "approved"
    rejected      = "rejected"
    re_inspection = "re_inspection"


class ComplianceReview(Base):
    __tablename__ = "compliance_reviews"

    inspection_id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("vehicle_inspections.id"), nullable=False)
    reviewer_id:   Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    decision:      Mapped[ReviewDecision]  = mapped_column(Enum(ReviewDecision, name="reviewdecision"), nullable=False)
    notes:         Mapped[str | None]      = mapped_column(Text)
    reviewed_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    inspection = relationship("VehicleInspection", foreign_keys=[inspection_id])
    reviewer   = relationship("User",              foreign_keys=[reviewer_id])
