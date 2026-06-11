import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
from app.models.load import Load
from app.models.shipment import Shipment
from app.models.user import User, UserRole
from app.services.commission_service import (
    attempt_commission_payment,
    get_owner_rate_preview,
    unblock_if_cleared,
)

router = APIRouter(prefix="/commissions", tags=["commissions"])

_OWNER_ROLES = [UserRole.owner, UserRole.owner_user, UserRole.driver]


def _invoice_out(inv: CommissionInvoice, load: Load | None = None) -> dict:
    return {
        "id":               str(inv.id),
        "shipment_id":      str(inv.shipment_id),
        "owner_id":         str(inv.owner_id),
        "amount_kes":       float(inv.amount_kes),
        "rate_used":        inv.rate_used,
        "rate_pct":         round(inv.rate_used * 100, 2),
        "rate_breakdown":   inv.rate_breakdown,
        "status":           inv.status,
        "due_at":           inv.due_at.isoformat() if inv.due_at else None,
        "paid_at":          inv.paid_at.isoformat() if inv.paid_at else None,
        "extended_until":   inv.extended_until.isoformat() if inv.extended_until else None,
        "window_hours":     inv.window_hours,
        "auto_blocked":     inv.auto_blocked,
        "created_at":       inv.created_at.isoformat() if hasattr(inv, "created_at") and inv.created_at else None,
        "pickup_location":  load.pickup_location  if load else None,
        "dropoff_location": load.dropoff_location if load else None,
        "load_price_kes":   float(load.price_kes) if load else None,
        "cargo_type":       load.cargo_type       if load else None,
    }


@router.get("")
async def list_my_commissions(
    status: str | None = Query(None, description="Filter by status: pending|paid|overdue|waived|extended"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    base_filter = CommissionInvoice.owner_id == current_user.id
    status_filter = None
    if status:
        try:
            status_filter = CommissionInvoice.status == CommissionInvoiceStatus(status)
        except ValueError:
            raise HTTPException(400, f"Invalid status '{status}'")
    total = (await db.scalar(
        select(func.count()).select_from(CommissionInvoice).where(base_filter)
    )) or 0
    q = (
        select(CommissionInvoice, Load)
        .join(Shipment, CommissionInvoice.shipment_id == Shipment.id)
        .join(Load, Shipment.load_id == Load.id)
        .where(base_filter)
    )
    if status_filter is not None:
        q = q.where(status_filter)
    q = q.order_by(CommissionInvoice.due_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).all()
    return {"items": [_invoice_out(r[0], r[1]) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/outstanding")
async def get_outstanding_commissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (await db.execute(
        select(CommissionInvoice, Load)
        .join(Shipment, CommissionInvoice.shipment_id == Shipment.id)
        .join(Load, Shipment.load_id == Load.id)
        .where(
            CommissionInvoice.owner_id == current_user.id,
            CommissionInvoice.status.in_([CommissionInvoiceStatus.pending, CommissionInvoiceStatus.overdue]),
        )
        .order_by(CommissionInvoice.due_at.asc())
    )).all()
    total_due = sum(float(r[0].amount_kes) for r in rows)
    return {"invoices": [_invoice_out(r[0], r[1]) for r in rows], "total_due_kes": total_due}


@router.get("/my-rate")
async def get_my_rate(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_owner_rate_preview(current_user.id, db)


@router.post("/{invoice_id}/pay")
async def pay_commission(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    invoice = await db.get(CommissionInvoice, invoice_id)
    if not invoice or invoice.owner_id != current_user.id:
        raise HTTPException(404, "Invoice not found")
    if invoice.status not in (CommissionInvoiceStatus.pending, CommissionInvoiceStatus.overdue):
        raise HTTPException(400, f"Invoice is already {invoice.status}")

    paid = await attempt_commission_payment(invoice, db)
    if not paid:
        raise HTTPException(402, "Insufficient wallet balance. Top up your wallet to pay this invoice.")

    await unblock_if_cleared(current_user.id, db)
    await db.commit()
    return {"status": "paid", "amount_kes": float(invoice.amount_kes)}


@router.post("/pay-all")
async def pay_all_outstanding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (await db.execute(
        select(CommissionInvoice).where(
            CommissionInvoice.owner_id == current_user.id,
            CommissionInvoice.status.in_([CommissionInvoiceStatus.pending, CommissionInvoiceStatus.overdue]),
        ).order_by(CommissionInvoice.due_at.asc())
    )).scalars().all()

    paid_count = 0
    paid_total = 0.0
    for inv in rows:
        if not await attempt_commission_payment(inv, db):
            break
        paid_count += 1
        paid_total += float(inv.amount_kes)

    await unblock_if_cleared(current_user.id, db)
    await db.commit()
    return {"paid_count": paid_count, "paid_total_kes": paid_total, "remaining": len(rows) - paid_count}


class CommissionCollectRequest(BaseModel):
    method_id: str
    account: str
    account_name: str | None = None


@router.post("/{invoice_id}/collect")
async def collect_commission(
    invoice_id: uuid.UUID,
    body: CommissionCollectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.services import payment_service as ps
    return await ps.collect_commission_payment(
        invoice_id=invoice_id,
        method_id=body.method_id,
        account=body.account,
        account_name=body.account_name,
        current_user=current_user,
        db=db,
    )
