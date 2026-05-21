import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.repositories.message_repo import MessageRepository
from app.schemas.message import MessageOut, UnreadCountOut

router = APIRouter(tags=["inbox"])


def _to_out(msg) -> MessageOut:
    return MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        recipient_id=msg.recipient_id,
        subject=msg.subject,
        body=msg.body,
        is_read=msg.is_read,
        message_type=msg.message_type,
        created_at=msg.created_at,
        sender_name=msg.sender.full_name if msg.sender else None,
    )


@router.get("", response_model=list[MessageOut])
async def list_inbox(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = MessageRepository(db)
    messages = await repo.list_for_recipient(current_user.id)
    return [_to_out(m) for m in messages]


# unread-count and read-all must be before /{message_id}/read to avoid path conflict
@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await MessageRepository(db).unread_count(current_user.id)
    return UnreadCountOut(count=count)


@router.post("/read-all", status_code=204)
async def mark_all_inbox_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await MessageRepository(db).mark_all_read(current_user.id)


@router.post("/{message_id}/read", response_model=MessageOut)
async def mark_message_read(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = MessageRepository(db)
    msg = await repo.mark_read(message_id, current_user.id)
    if not msg:
        raise NotFoundError("Message")
    return _to_out(msg)
