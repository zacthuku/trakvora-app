import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class AvailabilityStatus(str, enum.Enum):
    available = "available"
    on_job = "on_job"
    offline = "offline"


class Driver(Base):
    __tablename__ = "drivers"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    employer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Licence
    licence_number: Mapped[str] = mapped_column(String(50), nullable=False)
    licence_class: Mapped[str | None] = mapped_column(String(10))
    licence_expiry: Mapped[str | None] = mapped_column(String(20))
    licence_photo_url: Mapped[str | None] = mapped_column(String(500))

    # Verification
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.pending
    )
    ntsa_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Additional documents
    passport_photo_url: Mapped[str | None] = mapped_column(String(500))
    psv_badge_url: Mapped[str | None] = mapped_column(String(500))
    police_clearance_url: Mapped[str | None] = mapped_column(String(500))
    good_conduct_url: Mapped[str | None] = mapped_column(String(500))
    medical_cert_url: Mapped[str | None] = mapped_column(String(500))

    # Professional profile
    bio: Mapped[str | None] = mapped_column(Text)
    experience_years: Mapped[int | None] = mapped_column(Integer)
    preferred_routes: Mapped[str | None] = mapped_column(String(500))
    preferred_truck_types: Mapped[str | None] = mapped_column(String(200))

    # Availability
    availability_status: Mapped[AvailabilityStatus] = mapped_column(
        Enum(AvailabilityStatus), default=AvailabilityStatus.offline
    )
    availability_location: Mapped[str | None] = mapped_column(String(255))
    available_from: Mapped[str | None] = mapped_column(String(20))
    seeking_employment: Mapped[bool] = mapped_column(Boolean, default=False)

    # Truck assignment
    # use_alter=True breaks the circular FK cycle with trucks.assigned_driver_id
    # so SQLAlchemy can emit ALTER TABLE DROP CONSTRAINT before DROP TABLE in tests.
    current_truck_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trucks.id", use_alter=True, name="fk_drivers_current_truck_id"),
    )

    # Document submission & verification notes (added in migration 0019)
    documents_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Automated NTSA licence check (added in migration 0037)
    # Values: "unverified" | "pending" | "passed" | "failed"
    licence_check_status: Mapped[str] = mapped_column(String(20), default="unverified", nullable=False)
    licence_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    licence_check_detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    employer = relationship("User", foreign_keys=[employer_id])
    current_truck = relationship("Truck", foreign_keys=[current_truck_id])
