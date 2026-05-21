import enum
import uuid

from sqlalchemy import JSON, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TransactionType(str, enum.Enum):
    escrow_hold = "escrow_hold"
    escrow_release = "escrow_release"
    escrow_refund = "escrow_refund"
    payout = "payout"
    top_up = "top_up"
    withdrawal = "withdrawal"
    platform_fee = "platform_fee"
    dispute_hold = "dispute_hold"
    subscription_fee = "subscription_fee"


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    reversed = "reversed"


class Wallet(Base):
    __tablename__ = "wallets"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    balance_kes: Mapped[float] = mapped_column(Numeric(14, 2), default=0.00, nullable=False)
    escrow_kes: Mapped[float] = mapped_column(Numeric(14, 2), default=0.00, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="KES", nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    transactions = relationship("Transaction", back_populates="wallet", order_by="Transaction.created_at.desc()")


class Transaction(Base):
    __tablename__ = "transactions"

    wallet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wallets.id"), nullable=False)
    shipment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    amount_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus), default=TransactionStatus.pending)
    reference: Mapped[str | None] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(50))
    provider_reference: Mapped[str | None] = mapped_column(String(100))
    provider_transaction_id: Mapped[str | None] = mapped_column(String(100))
    provider_status: Mapped[str | None] = mapped_column(String(100))
    provider_metadata: Mapped[dict | None] = mapped_column(JSON)

    wallet = relationship("Wallet", back_populates="transactions")
    shipment = relationship("Shipment", foreign_keys=[shipment_id])
