import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PlanTier(str, enum.Enum):
    free = "free"
    fleet_basic = "fleet_basic"       # Up to 5 trucks
    fleet_pro = "fleet_pro"           # Up to 25 trucks
    enterprise = "enterprise"         # Unlimited + API access


class BillingCycle(str, enum.Enum):
    monthly = "monthly"
    annual = "annual"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    cancelled = "cancelled"
    trialing = "trialing"
    expired = "expired"


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    tier: Mapped[PlanTier] = mapped_column(Enum(PlanTier, name="plantier"), nullable=False)
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle, name="billingcycle"), nullable=False)
    price_kes: Mapped[float] = mapped_column(Float, nullable=False)
    max_trucks: Mapped[int | None] = mapped_column(Integer, nullable=True)        # None = unlimited
    max_drivers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    includes_api_access: Mapped[bool] = mapped_column(Boolean, default=False)
    includes_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    includes_priority_matching: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    subscriptions = relationship("Subscription", back_populates="plan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False)
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscriptionstatus"),
        default=SubscriptionStatus.trialing,
    )
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    flutterwave_subscription_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
