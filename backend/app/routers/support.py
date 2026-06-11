import random
import string
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.support_ticket import (
    SupportTicket, TicketMessage, TicketPriority, TicketStatus, TicketType,
)
from app.models.user import User, UserRole
from app.services import email_service

router = APIRouter(prefix="/support", tags=["support"])


def _gen_ticket_number() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"TRK-{suffix}"


def _serialize_ticket(t: SupportTicket, include_messages: bool = False) -> dict:
    data = {
        "id":            str(t.id),
        "ticket_number": t.ticket_number,
        "ticket_type":   t.ticket_type.value,
        "subject":       t.subject,
        "status":        t.status.value,
        "priority":      t.priority.value,
        "load_ref":      t.load_ref,
        "shipment_ref":  t.shipment_ref,
        "assigned_to":   str(t.assigned_to) if t.assigned_to else None,
        "assignee_name": t.assignee.full_name if t.assignee else None,
        "user_id":       str(t.user_id),
        "user_name":     t.user.full_name if t.user else None,
        "user_email":    t.user.email if t.user else None,
        "resolved_at":   t.resolved_at.isoformat() if t.resolved_at else None,
        "created_at":    t.created_at.isoformat() if t.created_at else None,
        "updated_at":    t.updated_at.isoformat() if t.updated_at else None,
    }
    if include_messages:
        data["messages"] = [_serialize_message(m) for m in (t.messages or [])]
    return data


def _serialize_message(m: TicketMessage) -> dict:
    return {
        "id":          str(m.id),
        "ticket_id":   str(m.ticket_id),
        "sender_id":   str(m.sender_id),
        "sender_name": m.sender.full_name if m.sender else None,
        "sender_role": m.sender.role.value if m.sender else None,
        "body":        m.body,
        "is_internal": m.is_internal,
        "attachments": m.attachments,
        "created_at":  m.created_at.isoformat() if m.created_at else None,
    }


# ── User endpoints ─────────────────────────────────────────────────────────────

class CreateTicketPayload(BaseModel):
    ticket_type: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=3, max_length=255)
    message: str = Field(..., min_length=10, max_length=5000)
    load_ref: str | None = Field(None, max_length=100)
    shipment_ref: str | None = Field(None, max_length=100)


class AddMessagePayload(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    is_internal: bool = False


@router.post("/tickets", status_code=201)
async def create_ticket(
    payload: CreateTicketPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ticket_type = payload.ticket_type if payload.ticket_type in [t.value for t in TicketType] else TicketType.general.value

    # Generate unique ticket number
    for _ in range(10):
        number = _gen_ticket_number()
        existing = (await db.execute(
            select(SupportTicket).where(SupportTicket.ticket_number == number)
        )).scalar_one_or_none()
        if not existing:
            break

    ticket = SupportTicket(
        ticket_number=number,
        user_id=current_user.id,
        ticket_type=TicketType(ticket_type),
        subject=payload.subject,
        status=TicketStatus.open,
        priority=TicketPriority.medium,
        load_ref=payload.load_ref,
        shipment_ref=payload.shipment_ref,
    )
    db.add(ticket)
    await db.flush()

    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        body=payload.message,
        is_internal=False,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(ticket)

    # Send confirmation email (non-blocking — best effort)
    try:
        await email_service.send_support_ticket_email(
            user_name=current_user.full_name,
            user_email=current_user.email,
            user_role=current_user.role.value,
            user_phone=current_user.phone,
            ticket_type=ticket_type,
            subject=payload.subject,
            load_ref=payload.load_ref,
            message=payload.message,
            support_email=settings.support_email,
        )
    except Exception:
        pass

    return {"ticket_number": ticket.ticket_number, "id": str(ticket.id)}


@router.get("/tickets")
async def list_my_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    q = select(SupportTicket).where(SupportTicket.user_id == current_user.id)
    if status_filter:
        q = q.where(SupportTicket.status == status_filter)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.options(selectinload(SupportTicket.user), selectinload(SupportTicket.assignee))
        .order_by(SupportTicket.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "items": [_serialize_ticket(t) for t in rows],
    }


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ticket = (await db.execute(
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id)
        .options(
            selectinload(SupportTicket.user),
            selectinload(SupportTicket.assignee),
            selectinload(SupportTicket.messages).selectinload(TicketMessage.sender),
        )
    )).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role != UserRole.admin and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _serialize_ticket(ticket, include_messages=True)


@router.post("/tickets/{ticket_id}/messages", status_code=201)
async def add_message(
    ticket_id: uuid.UUID,
    payload: AddMessagePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ticket = (await db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id)
    )).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    is_admin = current_user.role == UserRole.admin
    if not is_admin and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    # Only admins can post internal notes
    is_internal = payload.is_internal and is_admin

    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        body=payload.body,
        is_internal=is_internal,
    )
    db.add(msg)

    # Reopen if user replies to a resolved ticket
    if not is_admin and ticket.status == TicketStatus.resolved:
        ticket.status = TicketStatus.open
    # Move to in_progress when admin first replies
    if is_admin and ticket.status == TicketStatus.open:
        ticket.status = TicketStatus.in_progress

    await db.commit()
    await db.refresh(msg)
    # load sender
    await db.refresh(msg, ["sender"])
    return _serialize_message(msg)


# ── Admin endpoints ────────────────────────────────────────────────────────────

class AdminUpdateTicketPayload(BaseModel):
    status: str | None = None
    priority: str | None = None
    assigned_to: uuid.UUID | None = None


@router.get("/admin/tickets")
async def admin_list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    status_filter: str | None = Query(None, alias="status"),
    priority_filter: str | None = Query(None, alias="priority"),
    ticket_type_filter: str | None = Query(None, alias="ticket_type"),
    search: str | None = Query(None),
    _: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    q = select(SupportTicket)
    if status_filter:
        q = q.where(SupportTicket.status == status_filter)
    if priority_filter:
        q = q.where(SupportTicket.priority == priority_filter)
    if ticket_type_filter:
        q = q.where(SupportTicket.ticket_type == ticket_type_filter)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.options(selectinload(SupportTicket.user), selectinload(SupportTicket.assignee))
        .order_by(SupportTicket.updated_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "items": [_serialize_ticket(t) for t in rows],
    }


@router.patch("/admin/tickets/{ticket_id}")
async def admin_update_ticket(
    ticket_id: uuid.UUID,
    payload: AdminUpdateTicketPayload,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ticket = (await db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id)
        .options(selectinload(SupportTicket.user), selectinload(SupportTicket.assignee))
    )).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if payload.status and payload.status in [s.value for s in TicketStatus]:
        ticket.status = TicketStatus(payload.status)
        if payload.status == "resolved":
            ticket.resolved_at = datetime.now(timezone.utc)
    if payload.priority and payload.priority in [p.value for p in TicketPriority]:
        ticket.priority = TicketPriority(payload.priority)
    if payload.assigned_to is not None:
        ticket.assigned_to = payload.assigned_to

    await db.commit()
    await db.refresh(ticket)
    return _serialize_ticket(ticket)
