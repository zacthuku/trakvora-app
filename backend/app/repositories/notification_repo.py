import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        unread_only: bool = False,
        is_admin: bool = False,
    ) -> list[Notification]:
        q = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            q = q.where(Notification.is_read == False)  # noqa: E712
        if not is_admin:
            q = q.where(Notification.is_admin_notification == False)  # noqa: E712
        q = q.order_by(Notification.created_at.desc()).limit(50)
        result = await self.db.execute(q)
        return result.scalars().all()

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        notification_type,
        title: str,
        body: str,
        reference_id: uuid.UUID | None = None,
        reference_type: str | None = None,
        is_admin_notification: bool = False,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            reference_id=reference_id,
            reference_type=reference_type,
            is_admin_notification=is_admin_notification,
        )
        self.db.add(notification)
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification | None:
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if notification:
            notification.is_read = True
            await self.db.flush()
        return notification

    async def mark_all_read(self, user_id: uuid.UUID, is_admin: bool = False) -> None:
        notifications = await self.list_by_user(user_id, unread_only=True, is_admin=is_admin)
        for n in notifications:
            n.is_read = True
        await self.db.flush()
