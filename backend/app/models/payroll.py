import enum
import uuid

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PayrollStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"
    paid = "paid"
    cancelled = "cancelled"


class EmployeeSalary(Base):
    __tablename__ = "employee_salaries"
    __table_args__ = (UniqueConstraint("admin_user_id", "payment_month", name="uq_employee_salary_user_month"),)

    admin_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_month: Mapped[str] = mapped_column(String(7), nullable=False)  # "YYYY-MM"
    base_salary_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    housing_allowance_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    transport_allowance_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    bonus_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    bonus_reason: Mapped[str] = mapped_column(Text, nullable=True)
    total_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    paye_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    shif_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    nssf_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    net_pay_kes: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    employee_pin: Mapped[str] = mapped_column(String(20), nullable=True)  # KRA PIN for iTax
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=PayrollStatus.draft.value)
    approved_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    paid_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    employee = relationship("User", foreign_keys=[admin_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
