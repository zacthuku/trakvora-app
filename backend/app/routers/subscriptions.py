import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.subscription import (
    BillingCycle, PlanTier, Subscription, SubscriptionPlan, SubscriptionStatus,
)
from app.models.user import User
from app.models.wallet import TransactionStatus, TransactionType
from app.repositories.wallet_repo import WalletRepository

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class SubscribeRequest(BaseModel):
    plan_id: uuid.UUID


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    plan_name: str | None = None
    plan_tier: str | None = None
    status: SubscriptionStatus
    trial_ends_at: datetime | None
    current_period_end: datetime | None
    cancelled_at: datetime | None

    model_config = {"from_attributes": True}


class PlanOut(BaseModel):
    id: uuid.UUID
    name: str
    tier: PlanTier
    billing_cycle: BillingCycle
    price_kes: float
    max_trucks: int | None
    max_drivers: int | None
    includes_api_access: bool
    includes_analytics: bool
    includes_priority_matching: bool
    description: str | None

    model_config = {"from_attributes": True}


@router.get("/plans", response_model=list[PlanOut])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """Public — no auth required. Returns all active subscription plans."""
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.is_active == True)  # noqa: E712
    )
    return result.scalars().all()


@router.post("", response_model=SubscriptionOut, status_code=201)
async def subscribe(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await db.get(SubscriptionPlan, body.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Cancel any existing active subscription first
    existing_result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]),
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        existing.status = SubscriptionStatus.cancelled
        existing.cancelled_at = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    is_free = plan.tier == PlanTier.free
    period_end = now + timedelta(days=30 if plan.billing_cycle == BillingCycle.monthly else 365)

    if not is_free:
        wallet_repo = WalletRepository(db)
        wallet = await wallet_repo.get_by_user(current_user.id)
        balance = float(wallet.balance_kes) if wallet else 0.0
        if balance < plan.price_kes:
            shortfall = plan.price_kes - balance
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient balance. Top up KES {shortfall:,.0f} to activate this plan.",
            )
        await wallet_repo.update_balance(wallet, balance_delta=-plan.price_kes)
        await wallet_repo.create_transaction(
            wallet_id=wallet.id,
            transaction_type=TransactionType.subscription_fee,
            amount_kes=plan.price_kes,
            status=TransactionStatus.completed,
            description=f"Subscription: {plan.name}",
        )

    sub = Subscription(
        user_id=current_user.id,
        plan_id=plan.id,
        status=SubscriptionStatus.active,
        trial_ends_at=None,
        current_period_start=now,
        current_period_end=period_end,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {**sub.__dict__, "plan_name": plan.name, "plan_tier": plan.tier}


@router.get("/me", response_model=SubscriptionOut)
async def my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found")
    return {**sub.__dict__, "plan_name": sub.plan.name, "plan_tier": sub.plan.tier}


@router.patch("/me/cancel", response_model=SubscriptionOut)
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]),
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription to cancel")
    sub.status = SubscriptionStatus.cancelled
    sub.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return {**sub.__dict__, "plan_name": sub.plan.name, "plan_tier": sub.plan.tier}
