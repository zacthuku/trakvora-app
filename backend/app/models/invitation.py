import secrets
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class InvitationStatus(str, PyEnum):
    pending   = "pending"
    accepted  = "accepted"
    expired   = "expired"
    cancelled = "cancelled"


def _default_token() -> str:
    return secrets.token_urlsafe(32)


def _expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=7)


class Invitation(Base):
    """
    Generic invite-link record.

    One record covers all three onboarding cases:
      - company_id set           → company team member invite (company_member_role = admin/ops/viewer)
      - employer_user_id set     → driver employment invite from a fleet owner
      - admin_role set           → platform admin staff invite (super_admin only)

    role / admin_role are stored as plain strings to avoid conflicts with existing
    PostgreSQL enum types on the users table.
    """
    __tablename__ = "invitations"

    token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, default=_default_token
    )
    inviter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invitee_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Role the invitee will receive upon registration (stored as plain string)
    role: Mapped[str] = mapped_column(String(30), nullable=False)

    # Optional context — only one will be set per invite
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True
    )
    employer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    admin_role: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # For company team invites — which role inside the company (admin/ops/viewer)
    company_member_role: Mapped[str | None] = mapped_column(String(20), nullable=True, default="viewer")

    # Lifecycle
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus), default=InvitationStatus.pending, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_expires_at
    )

    # Relationships
    inviter:  Mapped["User"]    = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User", foreign_keys=[inviter_id], lazy="select"
    )
    employer: Mapped["User | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User", foreign_keys=[employer_user_id], lazy="select"
    )
    company:  Mapped["Company"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Company", foreign_keys=[company_id], lazy="select"
    )
