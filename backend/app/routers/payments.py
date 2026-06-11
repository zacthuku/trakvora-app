import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator, model_validator
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.load import Load
from app.models.notification import NotificationType
from app.models.shipment import Shipment
from app.models.user import User, UserRole
from app.schemas.wallet import TransactionListOut, TransactionOut, WalletOut
from app.services import payment_service, notification_service

router = APIRouter(tags=["payments"])


class TopUpRequest(BaseModel):
    amount: float | None = Field(None, gt=0, description="Amount to top up in the user's wallet currency")
    amount_kes: float | None = Field(None, gt=0, description="Legacy amount field")

    @model_validator(mode="after")
    def require_amount(self):
        if self.amount is None and self.amount_kes is None:
            raise ValueError("amount is required")
        return self

    @property
    def resolved_amount(self) -> float:
        return float(self.amount if self.amount is not None else self.amount_kes)


class TopUpResponse(BaseModel):
    payment_url: str
    tx_ref: str
    amount: float
    amount_kes: float
    currency: str


class WithdrawRequest(BaseModel):
    amount: float | None = Field(None, gt=0, description="Withdrawal amount in the user's wallet currency")
    amount_kes: float | None = Field(None, gt=0, description="Legacy withdrawal amount field")
    destination: str | None = Field(None, description="Optional payout destination details")
    payout_method: str | None = Field(None, description="mobile_money or bank")
    account_bank: str | None = Field(None, description="IntaSend bank code (for bank transfers)")
    account_number: str | None = Field(None, description="Recipient account or mobile money number")
    account_name: str | None = Field(None, description="Recipient account name")

    @model_validator(mode="after")
    def require_amount(self):
        if self.amount is None and self.amount_kes is None:
            raise ValueError("amount is required")
        return self

    @property
    def resolved_amount(self) -> float:
        return float(self.amount if self.amount is not None else self.amount_kes)


@router.get("/wallet", response_model=WalletOut)
async def get_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await payment_service.get_wallet(current_user, db)


@router.get("/transactions", response_model=TransactionListOut)
async def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await payment_service.get_transactions(current_user, db, page=page, page_size=page_size)


@router.post("/topup/initiate", response_model=TopUpResponse, status_code=201)
async def initiate_topup(
    body: TopUpRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await payment_service.initiate_topup(current_user, body.resolved_amount, db)


@router.post("/withdrawals", response_model=TransactionOut, status_code=201)
async def request_withdrawal(
    body: WithdrawRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await payment_service.request_withdrawal(
        current_user,
        body.resolved_amount,
        body.destination,
        db,
        payout_details={
            "payout_method": body.payout_method,
            "account_bank": body.account_bank,
            "account_number": body.account_number,
            "account_name": body.account_name,
        },
    )
    return result


DISPUTE_CATEGORIES = [
    "cargo_damage",       # Cargo damaged in transit
    "short_delivery",     # Goods delivered short / incomplete
    "wrong_location",     # Delivered to wrong address
    "delayed_delivery",   # Significantly delayed beyond agreed date
    "driver_misconduct",  # Driver behaviour / professionalism
    "no_delivery",        # Driver claims delivered but cargo not received
    "other",              # Catch-all — free text required
]


class OpenDisputeRequest(BaseModel):
    reason_category: str = Field(..., description=f"One of: {', '.join(DISPUTE_CATEGORIES)}")
    reason: str = Field(..., min_length=10, max_length=1000)

    @field_validator("reason_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in DISPUTE_CATEGORIES:
            raise ValueError(f"reason_category must be one of: {', '.join(DISPUTE_CATEGORIES)}")
        return v


@router.post("/shipments/{load_id}/open-dispute", status_code=200)
async def open_dispute(
    load_id: uuid.UUID,
    body: OpenDisputeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if current_user.role != UserRole.shipper:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only shippers can open disputes")

    load = (await db.execute(select(Load).where(Load.id == load_id))).scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Load not found")
    if load.shipper_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your load")

    shipment = (await db.execute(select(Shipment).where(Shipment.load_id == load_id))).scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    if shipment.dispute_open:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dispute already open")

    shipment.dispute_open = True
    shipment.dispute_reason = f"[{body.reason_category}] {body.reason}"
    shipment.dispute_opened_at = datetime.now(timezone.utc)
    await db.commit()

    # Notify all admins about the new dispute
    admin_rows = (await db.execute(select(User).where(User.role == UserRole.admin))).scalars().all()
    for admin in admin_rows:
        await notification_service.send_notification(
            user_id=admin.id,
            notification_type=NotificationType.dispute_opened,
            title="Dispute Opened",
            body=f"Shipper {current_user.full_name} opened a dispute on shipment {str(shipment.id)[:8]}.",
            reference_id=shipment.id,
            reference_type="shipment",
            db=db,
        )

    return {"shipment_id": str(shipment.id), "dispute_open": True}


# ── Stats endpoints ──────────────────────────────────────────────────────────

@router.get("/methods")
async def get_payment_methods(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    from sqlalchemy import select as _select
    from app.models.payment_method import PaymentMethod
    country = (getattr(current_user, "country", None) or "KE").upper()
    rows = (await db.execute(
        _select(PaymentMethod)
        .where(PaymentMethod.country_code == country, PaymentMethod.is_active == True)
        .order_by(PaymentMethod.sort_order)
    )).scalars().all()
    # Fallback to KE methods if no rows found for the user's country
    if not rows:
        rows = (await db.execute(
            _select(PaymentMethod)
            .where(PaymentMethod.country_code == "KE", PaymentMethod.is_active == True)
            .order_by(PaymentMethod.sort_order)
        )).scalars().all()
    return [
        {
            "id": r.method_id,
            "label": r.label,
            "type": r.type,
            "field": r.field,
            "icon": r.icon or ("📱" if r.type == "mobile" else "🏦"),
            "recipient_account": r.recipient_account,
            "recipient_name": r.recipient_name,
        }
        for r in rows
    ]


@router.get("/spending-stats")
async def get_spending_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    can_ship = (
        current_user.role == UserRole.shipper
        or (current_user.role in (UserRole.owner, UserRole.driver) and current_user.can_ship)
    )
    if not can_ship:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a shipper account")
    return await payment_service.get_spending_stats(current_user, db)


@router.get("/earning-stats")
async def get_earning_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if current_user.role not in (UserRole.driver, UserRole.owner, UserRole.owner_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a carrier account")
    return await payment_service.get_earning_stats(current_user, db)
