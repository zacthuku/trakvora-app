from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import email_service

router = APIRouter(prefix="/support", tags=["support"])


class TicketPayload(BaseModel):
    ticket_type: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=3, max_length=255)
    load_ref: str | None = Field(None, max_length=100)
    message: str = Field(..., min_length=10, max_length=5000)


@router.post("/tickets", status_code=status.HTTP_202_ACCEPTED)
async def submit_ticket(
    payload: TicketPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await email_service.send_support_ticket_email(
        user_name=current_user.full_name,
        user_email=current_user.email,
        user_role=current_user.role.value,
        user_phone=current_user.phone,
        ticket_type=payload.ticket_type,
        subject=payload.subject,
        load_ref=payload.load_ref,
        message=payload.message,
        support_email=settings.support_email,
    )
    return {"submitted": True}
