import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CommissionInvoiceStatus(str, enum.Enum):
    pending  = "pending"
    paid     = "paid"
    overdue  = "overdue"
    waived   = "waived"
    extended = "extended"


class CommissionInvoice(Base):
    __tablename__ = "commission_invoices"
    __table_args__ = (
        UniqueConstraint("shipment_id", name="uq_commission_invoice_shipment"),
    )

    shipment_id:    Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"), nullable=False, index=True)
    owner_id:       Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"),    nullable=False, index=True)
    amount_kes:     Mapped[float]      = mapped_column(Numeric(14, 2), nullable=False)
    rate_used:      Mapped[float]      = mapped_column(Float, nullable=False)
    rate_breakdown: Mapped[dict]       = mapped_column(JSONB, nullable=False)
    status: Mapped[CommissionInvoiceStatus] = mapped_column(
        Enum(CommissionInvoiceStatus, name="commissioninvoicestatus"),
        default=CommissionInvoiceStatus.pending,
        server_default="pending",
        nullable=False,
    )
    due_at:         Mapped[datetime]            = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at:        Mapped[datetime | None]     = mapped_column(DateTime(timezone=True), nullable=True)
    waived_by_id:   Mapped[uuid.UUID | None]   = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    extended_until: Mapped[datetime | None]     = mapped_column(DateTime(timezone=True), nullable=True)
    window_hours:   Mapped[int]                 = mapped_column(Integer, nullable=False, default=24)
    # True when this specific invoice triggered the account suspension
    auto_blocked:   Mapped[bool]                = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    shipment  = relationship("Shipment", foreign_keys=[shipment_id])
    owner     = relationship("User",     foreign_keys=[owner_id])
    waived_by = relationship("User",     foreign_keys=[waived_by_id])
