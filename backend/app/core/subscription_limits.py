import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.subscription import Subscription, SubscriptionPlan, SubscriptionStatus


async def get_effective_plan(user_id: uuid.UUID, db: AsyncSession) -> SubscriptionPlan | None:
    """Return the user's current active plan, or None if no subscription exists."""
    sub = (
        await db.execute(
            select(Subscription)
            .options(selectinload(Subscription.plan))
            .where(
                Subscription.user_id == user_id,
                Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]),
            )
            .order_by(Subscription.created_at.desc())
        )
    ).scalars().first()
    return sub.plan if sub and sub.plan else None
