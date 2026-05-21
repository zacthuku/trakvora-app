import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import Message, MessageType


class MessageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        sender_id: uuid.UUID,
        recipient_id: uuid.UUID,
        subject: str,
        body: str,
        message_type: str = "general",
    ) -> Message:
        msg = Message(
            sender_id=sender_id,
            recipient_id=recipient_id,
            subject=subject,
            body=body,
            message_type=MessageType(message_type),
        )
        self.db.add(msg)
        await self.db.flush()
        await self.db.refresh(msg)
        return msg

    async def list_for_recipient(self, recipient_id: uuid.UUID) -> list[Message]:
        result = await self.db.execute(
            select(Message)
            .options(selectinload(Message.sender))
            .where(Message.recipient_id == recipient_id)
            .order_by(Message.created_at.desc())
            .limit(100)
        )
        return result.scalars().all()

    async def get_by_id(self, message_id: uuid.UUID, user_id: uuid.UUID) -> Message | None:
        result = await self.db.execute(
            select(Message)
            .options(selectinload(Message.sender))
            .where(Message.id == message_id, Message.recipient_id == user_id)
        )
        return result.scalar_one_or_none()

    async def mark_read(self, message_id: uuid.UUID, user_id: uuid.UUID) -> Message | None:
        msg = await self.get_by_id(message_id, user_id)
        if msg:
            msg.is_read = True
            await self.db.flush()
        return msg

    async def mark_all_read(self, recipient_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(Message).where(
                Message.recipient_id == recipient_id,
                Message.is_read == False,  # noqa: E712
            )
        )
        for msg in result.scalars().all():
            msg.is_read = True
        await self.db.flush()

    async def unread_count(self, recipient_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).where(
                Message.recipient_id == recipient_id,
                Message.is_read == False,  # noqa: E712
            )
        )
        return result.scalar_one()
