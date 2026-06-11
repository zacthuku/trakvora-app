import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import JSON, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserRole(str, enum.Enum):
    shipper        = "shipper"
    owner          = "owner"
    # owner_user: operations sub-role under a vehicle owner.
    # Can manage fleet, drivers, and jobs, but cannot access financials/wallet.
    owner_user     = "owner_user"
    driver         = "driver"
    admin          = "admin"
    mover          = "mover"
    air_freight    = "air_freight"
    parcel_carrier = "parcel_carrier"


class AdminRole(str, enum.Enum):
    super_admin        = "super_admin"
    operations_admin   = "operations_admin"
    finance_admin      = "finance_admin"     # read/manage wallets, payouts, commissions
    field_inspector    = "field_inspector"
    iot_technician     = "iot_technician"
    compliance_officer = "compliance_officer"
    support_agent      = "support_agent"


class KycStatus(str, enum.Enum):
    unverified = "unverified"
    pending    = "pending"
    approved   = "approved"
    rejected   = "rejected"


class PartnerTier(str, enum.Enum):
    standard = "standard"    # registered + docs approved
    verified = "verified"    # ≥4.0 rating, good history
    premium  = "premium"     # ≥4.5 rating, enterprise-ready


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(25), unique=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True, default="KE")
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    national_id: Mapped[str | None] = mapped_column(String(50))
    kra_pin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    profile_photo_url: Mapped[str | None] = mapped_column(String(500))
    otp_channel: Mapped[str | None] = mapped_column(String(10), nullable=True)
    admin_role: Mapped[AdminRole | None] = mapped_column(Enum(AdminRole, name="adminrole"), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    show_on_team_page: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[float] = mapped_column(default=0.0)
    total_trips: Mapped[int] = mapped_column(default=0)
    cancellation_count: Mapped[int] = mapped_column(default=0)
    kyc_status: Mapped[KycStatus] = mapped_column(Enum(KycStatus, name="kycstatus"), default=KycStatus.unverified, nullable=False)
    kyc_rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    kyc_selfie_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    kra_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Firebase Cloud Messaging token — populated when user grants push permission
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Stores the user's role before an admin promotion, so revoke can restore it
    original_role: Mapped[UserRole | None] = mapped_column(Enum(UserRole, name="userrole"), nullable=True)

    # Cross-role capability flags — both default False, only super_admin can toggle
    can_carry: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    can_ship: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Allows shipper/owner to use escrow payment mode (higher commission, Trakvora holds funds)
    can_use_escrow: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Visible trust tier in the marketplace
    partner_tier: Mapped[PartnerTier] = mapped_column(
        Enum(PartnerTier, name="partnertier"),
        nullable=False,
        default=PartnerTier.standard,
        server_default="standard",
    )

    # Platform terms acceptance — version-stamped at registration time
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    terms_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notification_preferences: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Soft-delete — account is deactivated but data (invoices, shipments) is preserved
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Permanent ban — set by admin; blocks re-registration on any known identifier
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    ban_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ban_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
