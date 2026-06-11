import enum
import uuid as _uuid

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OnboardingFeeStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    expired = "expired"


class OnboardingFeeRecord(Base):
    __tablename__ = "onboarding_fee_records"

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4
    )
    owner_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    truck_type: Mapped[str] = mapped_column(String(40), nullable=False)
    amount_kes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[OnboardingFeeStatus] = mapped_column(
        Enum(OnboardingFeeStatus, name="onboarding_fee_status"),
        nullable=False,
        default=OnboardingFeeStatus.pending,
    )
    tx_ref: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    # Set when this fee record is consumed during truck creation
    truck_id: Mapped[_uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trucks.id", ondelete="SET NULL"), nullable=True
    )
    paid_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
