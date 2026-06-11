from sqlalchemy import Boolean, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PaymentMethod(Base):
    """
    Payment methods available per country — managed by finance/super admins.
    Replaces the hardcoded _PAYMENT_METHODS dict in payment_service.py.
    """
    __tablename__ = "payment_methods"
    __table_args__ = (UniqueConstraint("country_code", "method_id", name="uq_payment_method_country_id"),)

    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    method_id:    Mapped[str] = mapped_column(String(50), nullable=False)
    label:        Mapped[str] = mapped_column(String(100), nullable=False)
    type:         Mapped[str] = mapped_column(String(10), nullable=False)    # "mobile" | "bank"
    field:        Mapped[str] = mapped_column(String(10), nullable=False)    # "phone" | "account"
    bank_code:    Mapped[str | None] = mapped_column(String(20), nullable=True)   # IntaSend bank code
    mobile_bank:  Mapped[str | None] = mapped_column(String(30), nullable=True)   # IntaSend mobile ID
    icon:         Mapped[str | None] = mapped_column(String(10), nullable=True)   # emoji
    is_active:          Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)
    sort_order:         Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    notes:              Mapped[str | None] = mapped_column(Text, nullable=True)
    # trakvora's receiving account for this method (shown to payers)
    recipient_account:  Mapped[str | None] = mapped_column(String(100), nullable=True)  # paybill/till/account no
    recipient_name:     Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "trakvora Limited"
