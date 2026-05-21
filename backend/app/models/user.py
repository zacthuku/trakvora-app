import enum

from sqlalchemy import Boolean, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserRole(str, enum.Enum):
    shipper        = "shipper"
    owner          = "owner"
    driver         = "driver"
    admin          = "admin"
    mover          = "mover"
    air_freight    = "air_freight"
    parcel_carrier = "parcel_carrier"


class AdminRole(str, enum.Enum):
    super_admin        = "super_admin"
    operations_admin   = "operations_admin"
    field_inspector    = "field_inspector"
    iot_technician     = "iot_technician"
    compliance_officer = "compliance_officer"
    support_agent      = "support_agent"


class KycStatus(str, enum.Enum):
    unverified = "unverified"
    pending    = "pending"
    approved   = "approved"
    rejected   = "rejected"


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
    profile_photo_url: Mapped[str | None] = mapped_column(String(500))
    otp_channel: Mapped[str | None] = mapped_column(String(10), nullable=True)
    admin_role: Mapped[AdminRole | None] = mapped_column(Enum(AdminRole, name="adminrole"), nullable=True)
    rating: Mapped[float] = mapped_column(default=0.0)
    total_trips: Mapped[int] = mapped_column(default=0)
    cancellation_count: Mapped[int] = mapped_column(default=0)
    kyc_status: Mapped[KycStatus] = mapped_column(Enum(KycStatus, name="kycstatus"), default=KycStatus.unverified, nullable=False)
    kyc_rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
