import enum
import uuid

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EtimsInvoiceStatus(str, enum.Enum):
    pending = "pending"
    submitted = "submitted"
    accepted = "accepted"
    failed = "failed"


class EtimsInvoiceType(str, enum.Enum):
    platform_fee = "platform_fee"
    subscription = "subscription"


class EtimsInvoice(Base):
    __tablename__ = "etims_invoices"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id"), unique=True, nullable=False
    )

    # Internal invoice numbering (sequential, human-readable)
    internal_invoice_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    invoice_date: Mapped[str] = mapped_column(String(8), nullable=False)  # YYYYMMDD

    # Parties
    seller_pin: Mapped[str] = mapped_column(String(20), nullable=False)
    buyer_pin: Mapped[str | None] = mapped_column(String(20))
    buyer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    buyer_email: Mapped[str | None] = mapped_column(String(200))

    # KRA response
    cu_invoice_no: Mapped[str | None] = mapped_column(String(100))       # CUIN from KRA
    receipt_signature: Mapped[str | None] = mapped_column(String(200))
    qr_code_url: Mapped[str | None] = mapped_column(Text)
    kra_submission_date: Mapped[str | None] = mapped_column(String(30))  # ISO datetime string

    # Amounts (KES)
    taxable_amount_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    vat_amount_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total_amount_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    # Status tracking
    status: Mapped[EtimsInvoiceStatus] = mapped_column(
        Enum(EtimsInvoiceStatus), default=EtimsInvoiceStatus.pending, nullable=False
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text)
    kra_response: Mapped[dict | None] = mapped_column(JSON)

    # Metadata
    service_description: Mapped[str] = mapped_column(String(300), nullable=False)
    invoice_type: Mapped[EtimsInvoiceType] = mapped_column(Enum(EtimsInvoiceType), nullable=False)

    transaction = relationship("Transaction", foreign_keys=[transaction_id])
