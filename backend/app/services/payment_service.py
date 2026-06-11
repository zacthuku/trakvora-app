import logging
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.currency import currency_for_user
from app.core.exceptions import InsufficientFunds
from app.models.user import User, UserRole
from app.models.wallet import Transaction, TransactionStatus, TransactionType
from app.repositories.wallet_repo import WalletRepository
from app.schemas.wallet import TransactionListOut, TransactionOut, WalletOut

logger = logging.getLogger(__name__)


async def _get_or_create_wallet(current_user: User, repo: WalletRepository):
    wallet = await repo.get_by_user(current_user.id)
    resolved_currency = currency_for_user(current_user)
    if not wallet:
        return await repo.create_wallet(current_user.id, currency=resolved_currency)
    if (
        wallet.currency != resolved_currency
        and float(wallet.balance_kes) == 0
        and float(wallet.escrow_kes) == 0
    ):
        wallet.currency = resolved_currency
        await repo.db.flush()
        await repo.db.refresh(wallet)
    return wallet


async def get_wallet(current_user: User, db: AsyncSession) -> WalletOut:
    repo = WalletRepository(db)
    wallet = await _get_or_create_wallet(current_user, repo)
    return WalletOut.model_validate(wallet)


async def get_transactions(
    current_user: User,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> TransactionListOut:
    repo = WalletRepository(db)
    wallet = await repo.get_by_user(current_user.id)
    if not wallet:
        return TransactionListOut(items=[], total=0, page=page, page_size=page_size)
    items, total = await repo.list_transactions(wallet.id, page=page, page_size=page_size)
    return TransactionListOut(
        items=[TransactionOut.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def _normalize_phone(phone: str | None) -> str | None:
    """Convert 07XXXXXXXX or +2547XXXXXXXX to 2547XXXXXXXX for IntaSend."""
    if not phone:
        return None
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("+"):
        p = p[1:]
    if p.startswith("0") and len(p) == 10:
        p = "254" + p[1:]
    return p


async def _dispatch_intasend_payout(
    transaction: Transaction,
    wallet,
    details: dict,
) -> None:
    """Call IntaSend send-money API and update the transaction in-place. Does not commit."""
    payout_method = details.get("payout_method", "mobile_money")
    account_number = _normalize_phone(details.get("account_number") or details.get("phone_number"))
    account_name = details.get("account_name") or details.get("name", "")
    reference = transaction.provider_reference or transaction.reference or f"withdrawal-{transaction.id}"

    tx_entry: dict = {
        "name": account_name,
        "account": account_number,
        "amount": float(transaction.amount_kes),
        "narrative": details.get("narration") or "Trakvora wallet withdrawal",
    }
    if payout_method == "bank":
        bank_code = details.get("bank_code") or details.get("account_bank")
        if bank_code:
            tx_entry["bank_code"] = bank_code
        send_path = "/api/v1/send-money/bank/"
    else:
        send_path = "/api/v1/send-money/mpesa/"

    payload: dict = {"currency": wallet.currency, "transactions": [tx_entry]}
    if settings.intasend_webhook_url:
        payload["callback_url"] = settings.intasend_webhook_url

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{settings.intasend_base_url}{send_path}",
                json=payload,
                headers={
                    "Authorization": f"Token {settings.intasend_secret_key}",
                    "Content-Type": "application/json",
                },
            )
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        transaction.provider_status = "provider_request_failed"
        raise HTTPException(status_code=502, detail=f"Payout provider request failed: {exc}") from exc

    if response.status_code not in (200, 201):
        transaction.provider_status = "provider_request_failed"
        raise HTTPException(
            status_code=502,
            detail=(data.get("message") or data.get("detail") or "Unable to create transfer"),
        )

    tracking_id = str(data.get("tracking_id") or "")
    provider_status = str(data.get("status") or "pending").lower()
    transaction.provider = "intasend"
    transaction.provider_reference = tracking_id or reference
    transaction.provider_transaction_id = tracking_id or None
    transaction.provider_status = provider_status
    if provider_status in {"successful", "completed", "complete"}:
        transaction.status = TransactionStatus.completed


async def request_withdrawal(
    current_user: User,
    amount_kes: float,
    destination: str | None,
    db: AsyncSession,
    payout_details: dict | None = None,
) -> TransactionOut:
    if amount_kes <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be greater than zero")
    if not settings.intasend_secret_key:
        raise HTTPException(status_code=503, detail="Payout provider is not configured")

    details = {"destination": destination, **(payout_details or {})}
    account_number = _normalize_phone(details.get("account_number") or details.get("phone_number"))
    if not account_number:
        raise HTTPException(status_code=400, detail="Account number or phone number is required")

    repo = WalletRepository(db)
    wallet = await _get_or_create_wallet(current_user, repo)
    if not wallet or float(wallet.balance_kes) < amount_kes:
        raise InsufficientFunds()

    reference = f"withdrawal-{uuid.uuid4()}"
    details["account_number"] = account_number  # store normalized phone
    transaction = await repo.create_transaction(
        wallet_id=wallet.id,
        shipment_id=None,
        transaction_type=TransactionType.withdrawal,
        amount_kes=amount_kes,
        status=TransactionStatus.pending,
        description=f"Withdrawal request{(' to ' + destination) if destination else ''}",
        reference=reference,
        provider="intasend",
        provider_reference=reference,
        provider_status="queued",
        provider_metadata=details,
    )
    await repo.update_balance(wallet, balance_delta=-amount_kes)

    try:
        await _dispatch_intasend_payout(transaction, wallet, details)
    except HTTPException:
        # Payout dispatch failed — refund the balance so user is not left out of pocket
        await repo.update_balance(wallet, balance_delta=+amount_kes)
        transaction.status = TransactionStatus.failed
        await db.commit()
        raise

    await db.commit()
    return TransactionOut.model_validate(transaction)


async def approve_withdrawal(
    transaction_id: uuid.UUID,
    db: AsyncSession,
    provider: str = "manual",
    manual_reference: str | None = None,
) -> TransactionOut:
    """Admin-only: mark a failed/stuck withdrawal as manually completed, or retry via IntaSend."""
    transaction = await db.get(Transaction, transaction_id)
    if not transaction or transaction.transaction_type != TransactionType.withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal transaction not found")
    if transaction.status not in (TransactionStatus.pending, TransactionStatus.failed):
        raise HTTPException(status_code=400, detail="Only pending or failed withdrawals can be approved")

    repo = WalletRepository(db)
    wallet = await repo.get_by_id(transaction.wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    if provider == "manual":
        transaction.status = TransactionStatus.completed
        transaction.provider = "manual"
        transaction.provider_reference = manual_reference or transaction.reference
        transaction.provider_status = "completed"
        await db.commit()
        await db.refresh(transaction)
        return TransactionOut.model_validate(transaction)

    if provider == "intasend":
        if not settings.intasend_secret_key:
            raise HTTPException(status_code=503, detail="IntaSend is not configured")
        details = transaction.provider_metadata or {}
        if not (details.get("account_number") or details.get("phone_number")):
            raise HTTPException(status_code=400, detail="Withdrawal is missing payout account details")
        transaction.provider_status = "queued"
        await _dispatch_intasend_payout(transaction, wallet, details)
        await db.commit()
        await db.refresh(transaction)
        return TransactionOut.model_validate(transaction)

    raise HTTPException(status_code=400, detail="Unsupported payout provider")


async def reject_withdrawal(
    transaction_id: uuid.UUID,
    db: AsyncSession,
    reason: str | None = None,
) -> TransactionOut:
    transaction = await db.get(Transaction, transaction_id)
    if not transaction or transaction.transaction_type != TransactionType.withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal transaction not found")
    if transaction.status != TransactionStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending withdrawals can be rejected")

    repo = WalletRepository(db)
    wallet = await repo.get_by_id(transaction.wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    await repo.update_balance(wallet, balance_delta=float(transaction.amount_kes))
    transaction.status = TransactionStatus.reversed
    transaction.provider_status = "rejected"
    transaction.description = f"{transaction.description or 'Withdrawal request'} — rejected{(': ' + reason) if reason else ''}"
    await db.commit()
    await db.refresh(transaction)
    return TransactionOut.model_validate(transaction)


async def initiate_topup(current_user: User, amount_kes: float, db: AsyncSession) -> dict[str, object]:
    if amount_kes < 10:
        raise HTTPException(status_code=400, detail="Minimum top-up amount is 10")

    if not settings.intasend_secret_key:
        raise HTTPException(status_code=503, detail="IntaSend is not configured")

    repo = WalletRepository(db)
    wallet = await _get_or_create_wallet(current_user, repo)

    tx_ref = f"trakvora-{uuid.uuid4()}"
    redirect_url = settings.intasend_redirect_url or (
        settings.cors_origins_list[0] if settings.cors_origins_list else "http://localhost:5173"
    )
    name_parts = (current_user.full_name or "").split(" ", 1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    payload = {
        "public_key": settings.intasend_public_key,
        "currency": wallet.currency,
        "amount": str(round(amount_kes, 2)),
        "email": current_user.email,
        "first_name": first_name,
        "last_name": last_name,
        "api_ref": tx_ref,
        "redirect_url": redirect_url,
        "comment": "Trakvora wallet top-up",
    }
    if settings.intasend_webhook_url:
        payload["webhook_url"] = settings.intasend_webhook_url

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{settings.intasend_base_url}/api/v1/checkout/",
                json=payload,
                headers={
                    "Authorization": f"Token {settings.intasend_secret_key}",
                    "Content-Type": "application/json",
                },
            )
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Payment provider request failed: {exc}") from exc

    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=(data.get("detail") or data.get("message") or "Unable to create payment session"),
        )

    payment_url = data.get("url")
    invoice_id = str(data.get("id") or "")
    if not payment_url:
        raise HTTPException(status_code=502, detail="Payment provider did not return a payment link")

    await repo.create_transaction(
        wallet_id=wallet.id,
        shipment_id=None,
        transaction_type=TransactionType.top_up,
        amount_kes=amount_kes,
        status=TransactionStatus.pending,
        description="Pending wallet top-up via IntaSend",
        reference=tx_ref,
        provider="intasend",
        provider_reference=tx_ref,
        provider_transaction_id=invoice_id or None,
    )
    await db.commit()

    return {
        "payment_url": payment_url,
        "tx_ref": tx_ref,
        "amount_kes": amount_kes,
        "amount": amount_kes,
        "currency": wallet.currency,
    }


async def lock_escrow(shipment_id: uuid.UUID, shipper_user_id: uuid.UUID, amount_kes: float, db: AsyncSession) -> None:
    repo = WalletRepository(db)
    wallet = await repo.get_by_user(shipper_user_id)
    if not wallet or float(wallet.balance_kes) < amount_kes:
        raise InsufficientFunds()
    await repo.update_balance(wallet, balance_delta=-amount_kes, escrow_delta=amount_kes)
    await repo.create_transaction(
        wallet_id=wallet.id,
        shipment_id=shipment_id,
        transaction_type=TransactionType.escrow_hold,
        amount_kes=amount_kes,
        status=TransactionStatus.completed,
        description=f"Escrow hold for shipment",
    )


async def release_escrow(
    shipment_id: uuid.UUID,
    shipper_user_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    amount_kes: float,
    db: AsyncSession,
    delivered_at: "datetime | None" = None,
) -> None:
    """
    Release escrow on delivery confirmation (escrow payment mode only).
    Owner receives the full freight amount; commission is invoiced separately
    via the dynamic commission engine and auto-deducted from owner's wallet.
    """
    from datetime import datetime as _dt, timezone as _tz
    from app.models.load import Load
    from app.models.shipment import Shipment
    from app.models.truck import Truck
    from app.models.user import User as UserModel
    from app.services import commission_service, notification_service
    from app.models.notification import NotificationType
    from sqlalchemy import select as sa_select

    repo = WalletRepository(db)

    shipper_result = await db.execute(sa_select(UserModel).where(UserModel.id == shipper_user_id))
    shipper_user   = shipper_result.scalar_one_or_none()
    country        = (shipper_user.country or "KE").upper() if shipper_user else "KE"

    # Release shipper escrow in full (owner gets full amount — commission is separate)
    shipper_wallet = await repo.get_by_user(shipper_user_id)
    if shipper_wallet:
        await repo.update_balance(shipper_wallet, balance_delta=0, escrow_delta=-amount_kes)
        await repo.create_transaction(
            wallet_id        = shipper_wallet.id,
            shipment_id      = shipment_id,
            transaction_type = TransactionType.escrow_release,
            amount_kes       = amount_kes,
            status           = TransactionStatus.completed,
            description      = "Escrow released on delivery",
        )

    # Pay owner the full freight amount
    owner_wallet = await repo.get_by_user(owner_user_id)
    if not owner_wallet:
        owner_wallet = await repo.create_wallet(
            owner_user_id,
            currency=shipper_wallet.currency if shipper_wallet else "KES",
        )
    await repo.update_balance(owner_wallet, balance_delta=amount_kes)
    await repo.create_transaction(
        wallet_id        = owner_wallet.id,
        shipment_id      = shipment_id,
        transaction_type = TransactionType.payout,
        amount_kes       = amount_kes,
        status           = TransactionStatus.completed,
        description      = "Payment received for completed delivery (escrow)",
    )

    # Create commission invoice for owner (escrow mode = 1.30x rate multiplier)
    shipment = await db.get(Shipment, shipment_id)
    if shipment:
        load  = await db.get(Load, shipment.load_id)
        truck = await db.get(Truck, shipment.truck_id)
        if load and truck:
            now = delivered_at or _dt.now(_tz.utc)
            invoice, calc = await commission_service.compute_and_create_invoice(
                shipment_id          = shipment_id,
                owner_id             = owner_user_id,
                shipper_country      = country,
                freight_amount_kes   = amount_kes,
                truck                = truck,
                load                 = load,
                payment_confirmed_at = now,
                db                   = db,
            )
            paid = await commission_service.attempt_commission_payment(invoice, db)
            if not paid:
                await notification_service.send_notification(
                    user_id           = owner_user_id,
                    notification_type = NotificationType.system,
                    title             = "Commission Invoice — Payment Due",
                    body              = (
                        f"A commission of KES {float(invoice.amount_kes):,.0f} is due by "
                        f"{invoice.due_at.strftime('%d %b %Y %H:%M UTC')}. "
                        f"Top up your wallet to avoid account suspension."
                    ),
                    reference_id   = invoice.id,
                    reference_type = "commission_invoice",
                    db             = db,
                )


async def confirm_direct_payment(
    shipment_id: uuid.UUID,
    shipper_user_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    amount_kes: float,
    db: AsyncSession,
) -> None:
    """
    Handle direct-mode payment: shipper has already paid the carrier directly (cash/mobile/bank).
    Trakvora only needs to calculate and create a commission invoice for the carrier.
    Commission is auto-deducted from the carrier's wallet if they have sufficient balance;
    otherwise they receive a notification to pay within the due window.
    """
    from datetime import datetime as _dt, timezone as _tz
    from app.models.load import Load
    from app.models.shipment import Shipment
    from app.models.truck import Truck
    from app.models.user import User as UserModel
    from app.services import commission_service, notification_service
    from app.models.notification import NotificationType
    from sqlalchemy import select as sa_select

    shipper_user_result = await db.execute(sa_select(UserModel).where(UserModel.id == shipper_user_id))
    shipper_user = shipper_user_result.scalar_one_or_none()
    country = (shipper_user.country or "KE").upper() if shipper_user else "KE"

    # Create commission invoice for the carrier; no wallet-to-wallet transfer happens
    shipment = await db.get(Shipment, shipment_id)
    if shipment:
        load  = await db.get(Load, shipment.load_id)
        truck = await db.get(Truck, shipment.truck_id)
        if load and truck:
            now = _dt.now(_tz.utc)
            invoice, calc = await commission_service.compute_and_create_invoice(
                shipment_id          = shipment_id,
                owner_id             = owner_user_id,
                shipper_country      = country,
                freight_amount_kes   = amount_kes,
                truck                = truck,
                load                 = load,
                payment_confirmed_at = now,
                db                   = db,
            )
            paid = await commission_service.attempt_commission_payment(invoice, db)
            if not paid:
                await notification_service.send_notification(
                    user_id           = owner_user_id,
                    notification_type = NotificationType.system,
                    title             = "Commission Invoice — Payment Due",
                    body              = (
                        f"A commission of KES {float(invoice.amount_kes):,.0f} is due by "
                        f"{invoice.due_at.strftime('%d %b %Y %H:%M UTC')}. "
                        f"Pay via the Commissions tab to avoid account suspension."
                    ),
                    reference_id   = invoice.id,
                    reference_type = "commission_invoice",
                    db             = db,
                )


# ── Stats helpers ────────────────────────────────────────────────────────────

def _month_key(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m")


def _last_6_months() -> list[str]:
    now = datetime.now(timezone.utc)
    return [
        (now.replace(day=1) - timedelta(days=30 * i)).strftime("%Y-%m")
        for i in range(5, -1, -1)
    ]


async def get_spending_stats(current_user: User, db: AsyncSession) -> dict:
    """Spending stats for shippers — aggregated from delivered loads."""
    from app.models.load import Load, LoadStatus
    from app.models.shipment import Shipment as _Shipment

    rows = (await db.execute(
        select(Load.price_kes, _Shipment.delivered_at)
        .join(_Shipment, _Shipment.load_id == Load.id, isouter=True)
        .where(Load.shipper_id == current_user.id, Load.status == LoadStatus.delivered)
    )).all()

    total = sum(float(r.price_kes) for r in rows)
    count = len(rows)
    avg   = total / count if count else 0.0

    monthly_map: dict[str, float] = {m: 0.0 for m in _last_6_months()}
    for r in rows:
        k = _month_key(r.delivered_at)
        if k in monthly_map:
            monthly_map[k] += float(r.price_kes)

    return {
        "total_spent_kes": round(total, 2),
        "completed_loads": count,
        "avg_per_load_kes": round(avg, 2),
        "monthly": [{"month": m, "total_kes": round(monthly_map[m], 2)} for m in monthly_map],
    }


async def get_earning_stats(current_user: User, db: AsyncSession) -> dict:
    """Earning stats for drivers (self-employed) and fleet owners."""
    from app.models.load import Load, LoadStatus
    from app.models.shipment import Shipment as _Shipment
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    from app.models.driver import Driver

    is_driver = current_user.role == UserRole.driver

    if is_driver:
        driver_row = (await db.execute(
            select(Driver).where(Driver.user_id == current_user.id)
        )).scalar_one_or_none()
        if driver_row and driver_row.employer_id is not None:
            count = (await db.scalar(
                select(func.count(_Shipment.id)).where(
                    _Shipment.driver_id == current_user.id,
                    _Shipment.status == LoadStatus.delivered,
                )
            )) or 0
            return {"completed_trips": count, "is_employed": True}

    filter_col = _Shipment.driver_id if is_driver else _Shipment.owner_id

    rows = (await db.execute(
        select(Load.price_kes, _Shipment.delivered_at)
        .join(Load, Load.id == _Shipment.load_id)
        .where(filter_col == current_user.id, _Shipment.status == LoadStatus.delivered)
    )).all()

    total = sum(float(r.price_kes) for r in rows)
    count = len(rows)
    avg   = total / count if count else 0.0

    monthly_map: dict[str, float] = {m: 0.0 for m in _last_6_months()}
    for r in rows:
        k = _month_key(r.delivered_at)
        if k in monthly_map:
            monthly_map[k] += float(r.price_kes)

    comm_rows = (await db.execute(
        select(CommissionInvoice).where(CommissionInvoice.owner_id == current_user.id)
    )).scalars().all()

    paid_kes    = sum(float(r.amount_kes) for r in comm_rows if r.status == CommissionInvoiceStatus.paid)
    pending_kes = sum(float(r.amount_kes) for r in comm_rows if r.status in (CommissionInvoiceStatus.pending, CommissionInvoiceStatus.overdue))

    in_progress_prices = (await db.execute(
        select(Load.price_kes)
        .join(_Shipment, Load.id == _Shipment.load_id)
        .where(filter_col == current_user.id, _Shipment.status == LoadStatus.in_transit)
    )).scalars().all()
    next_job_kes = sum(float(p) * 0.08 for p in in_progress_prices)

    return {
        "total_earned_kes": round(total, 2),
        "completed_trips": count,
        "avg_per_trip_kes": round(avg, 2),
        "is_employed": False,
        "monthly": [{"month": m, "total_kes": round(monthly_map[m], 2)} for m in monthly_map],
        "commission": {
            "paid_kes":     round(paid_kes, 2),
            "pending_kes":  round(pending_kes, 2),
            "next_job_kes": round(next_job_kes, 2),
        },
    }


async def collect_commission_payment(
    invoice_id: uuid.UUID,
    method_id: str,
    account: str,
    account_name: str | None,
    current_user: User,
    db: AsyncSession,
) -> dict:
    """Initiate collection of a commission invoice via mobile money or bank."""
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus

    invoice = await db.get(CommissionInvoice, invoice_id)
    if not invoice or invoice.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in (CommissionInvoiceStatus.pending, CommissionInvoiceStatus.overdue):
        raise HTTPException(status_code=400, detail=f"Invoice is already {invoice.status}")

    amount_kes = float(invoice.amount_kes)
    api_ref = f"comm-{invoice.id}"

    # Look up method type from DB instead of hardcoded set
    from app.models.payment_method import PaymentMethod
    method_row = (await db.execute(
        select(PaymentMethod).where(PaymentMethod.method_id == method_id, PaymentMethod.is_active == True)
    )).scalar_one_or_none()
    is_mobile = method_row is not None and method_row.type == "mobile"

    if is_mobile:
        if not settings.intasend_secret_key:
            raise HTTPException(status_code=503, detail="Payment provider not configured")

        phone = _normalize_phone(account)
        if not phone:
            raise HTTPException(status_code=400, detail="Valid phone number required")

        payload = {
            "currency": "KES",
            "amount": str(round(amount_kes, 2)),
            "phone_number": phone,
            "api_ref": api_ref,
            "narrative": f"trakvora commission {str(invoice.id)[:8]}",
        }
        if settings.intasend_webhook_url:
            payload["callback_url"] = settings.intasend_webhook_url

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    f"{settings.intasend_base_url}/api/v1/payment/collection/",
                    json=payload,
                    headers={
                        "Authorization": f"Token {settings.intasend_secret_key}",
                        "Content-Type": "application/json",
                    },
                )
                data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(status_code=502, detail=f"Payment provider request failed: {exc}") from exc

        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=(data.get("detail") or data.get("message") or "Unable to initiate payment"),
            )

        await db.commit()
        tracking_id = str(data.get("tracking_id") or data.get("id") or api_ref)

        return {
            "status": "pending",
            "message": f"Payment request sent to {phone[:6]}***. Enter your PIN to confirm.",
            "tracking_id": tracking_id,
        }

    # Bank transfer: return instructions
    return {
        "status": "instructions",
        "method": "bank",
        "reference": api_ref,
        "amount_kes": amount_kes,
        "instructions": (
            "Transfer the exact amount to trakvora's business bank account "
            "using the reference number shown. Your invoice will be marked "
            "paid once confirmed by our finance team."
        ),
    }
