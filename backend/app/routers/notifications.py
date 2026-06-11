import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.repositories.notification_repo import NotificationRepository
from app.schemas.notification import NotificationOut

router = APIRouter(tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select as sa_select
    from app.models.bid import Bid

    is_admin = current_user.role == UserRole.admin
    repo = NotificationRepository(db)
    notifications = await repo.list_by_user(current_user.id, unread_only=unread_only, is_admin=is_admin)

    # Batch-resolve bid_id → load_id for bid-type notifications (at most 1 extra query)
    bid_ids = [n.reference_id for n in notifications if n.reference_type == "bid" and n.reference_id]
    bid_load_map: dict = {}
    if bid_ids:
        rows = (await db.execute(sa_select(Bid.id, Bid.load_id).where(Bid.id.in_(bid_ids)))).all()
        bid_load_map = {r.id: r.load_id for r in rows}

    result = []
    for n in notifications:
        out = NotificationOut.model_validate(n)
        if n.reference_type == "bid" and n.reference_id in bid_load_map:
            out.resolved_load_id = bid_load_map[n.reference_id]
        result.append(out)
    return result


# read-all must be before /{notification_id}/read to avoid path conflict
@router.post("/read-all", status_code=204)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    is_admin = current_user.role == UserRole.admin
    await NotificationRepository(db).mark_all_read(current_user.id, is_admin=is_admin)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = NotificationRepository(db)
    notification = await repo.mark_read(notification_id, current_user.id)
    if not notification:
        raise NotFoundError("Notification")
    return notification
