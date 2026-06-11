"""
IntaSend webhook handler.

IntaSend sends signed POST requests for collection and send-money events.
Signature: X-IntaSend-Signature header (HMAC-SHA256 of raw body using webhook secret).

Events handled:
  state == COMPLETE (collection)  → credit user wallet on successful top-up
  state == COMPLETE/FAILED (send-money) → update withdrawal transaction status
"""
import hashlib
import hmac
import json
import uuid

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType
from app.repositories.wallet_repo import WalletRepository

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_intasend_signature(body: bytes, signature: str | None) -> bool:
    secret = settings.intasend_webhook_secret
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _verify_intasend_collection(invoice_id: str) -> dict | None:
    if not invoice_id or not settings.intasend_secret_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{settings.intasend_base_url}/api/v1/payment/collection/{invoice_id}/",
                headers={"Authorization": f"Token {settings.intasend_secret_key}"},
            )
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return None
    if response.status_code != 200:
        return None
    return data


@router.post("/intasend")
async def intasend_webhook(
    request: Request,
    x_intasend_signature: str = Header(None, alias="x-intasend-signature"),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    signature_ok = _verify_intasend_signature(body, x_intasend_signature)

    if settings.environment == "production" and not signature_ok:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    state = str(payload.get("state", "")).upper()
    invoice_id = str(payload.get("invoice_id") or payload.get("id") or "")
    api_ref = str(payload.get("api_ref") or payload.get("tx_ref") or "")
    tracking_id = str(payload.get("tracking_id") or "")

    if tracking_id:
        # Send-money (withdrawal) event
        await _handle_transfer_event(payload, db)
    elif state == "COMPLETE" and (invoice_id or api_ref):
        # Collection (top-up) event — verify with API before crediting
        verified = await _verify_intasend_collection(invoice_id) if invoice_id else None
        if settings.environment == "production" and not verified:
            raise HTTPException(status_code=502, detail="Unable to verify IntaSend transaction")
        if verified:
            payload = {**payload, **verified}
        # Route to the correct handler based on tx_ref prefix
        if api_ref.startswith("onboarding-"):
            await _handle_onboarding_fee_paid(api_ref, db)
        else:
            await _handle_charge_completed(payload, db)

    return {"status": "ok"}


async def _handle_charge_completed(data: dict, db: AsyncSession) -> None:
    """Credit the user wallet on a successful top-up."""
    customer = data.get("customer") or {}
    user_id_str = (
        data.get("meta", {}) or {}
    ).get("user_id") or customer.get("email") or ""
    amount = float(data.get("amount") or data.get("net_amount") or 0)
    currency = data.get("currency")
    tx_ref = data.get("api_ref") or data.get("tx_ref") or ""

    if not user_id_str or amount <= 0:
        return

    user = None
    try:
        user_uuid = uuid.UUID(user_id_str)
        user = await db.get(User, user_uuid)
    except ValueError:
        result = await db.execute(select(User).where(User.email == user_id_str))
        user = result.scalar_one_or_none()

    if not user:
        return

    repo = WalletRepository(db)
    wallet = await repo.get_by_user(user.id)
    if not wallet:
        wallet = await repo.create_wallet(user.id)

    existing = await repo.get_transaction_by_reference(tx_ref) if tx_ref else None
    if existing and existing.status == TransactionStatus.completed:
        return

    if existing:
        expected_amount = float(existing.amount_kes)
        if round(expected_amount, 2) != round(amount, 2):
            existing.status = TransactionStatus.failed
            existing.description = f"IntaSend amount mismatch for ref: {tx_ref}"
            await db.commit()
            return

    if wallet.currency and currency and wallet.currency != currency:
        if existing:
            existing.status = TransactionStatus.failed
            existing.description = f"IntaSend currency mismatch for ref: {tx_ref}"
            await db.commit()
        return

    await repo.update_balance(wallet, balance_delta=amount)

    if existing:
        existing.status = TransactionStatus.completed
        existing.transaction_type = TransactionType.top_up
        existing.description = f"Wallet top-up via IntaSend (ref: {tx_ref})"
        existing.amount_kes = amount
        await db.flush()
    else:
        await repo.create_transaction(
            wallet_id=wallet.id,
            shipment_id=None,
            transaction_type=TransactionType.top_up,
            amount_kes=amount,
            status=TransactionStatus.completed,
            description=f"Wallet top-up via IntaSend (ref: {tx_ref})",
            reference=tx_ref,
        )

    # Instantly attempt to clear any pending/overdue commission invoices for this user
    # so they are unblocked immediately rather than waiting for the hourly scheduler
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    from app.services.commission_service import attempt_commission_payment, unblock_if_cleared

    pending_invoices = (await db.execute(
        select(CommissionInvoice).where(
            CommissionInvoice.owner_id == user.id,
            CommissionInvoice.status.in_([
                CommissionInvoiceStatus.pending,
                CommissionInvoiceStatus.overdue,
            ]),
        ).order_by(CommissionInvoice.due_at.asc())
    )).scalars().all()

    for inv in pending_invoices:
        if not await attempt_commission_payment(inv, db):
            break  # wallet balance exhausted

    await unblock_if_cleared(user.id, db)
    await db.commit()


async def _handle_onboarding_fee_paid(tx_ref: str, db: AsyncSession) -> None:
    """Mark an OnboardingFeeRecord as paid when IntaSend confirms the checkout."""
    from datetime import timezone as _tz
    from app.models.onboarding_fee import OnboardingFeeRecord, OnboardingFeeStatus

    record = (await db.execute(
        select(OnboardingFeeRecord).where(OnboardingFeeRecord.tx_ref == tx_ref)
    )).scalar_one_or_none()

    if not record or record.status == OnboardingFeeStatus.paid:
        return

    record.status = OnboardingFeeStatus.paid
    record.paid_at = datetime.now(_tz.utc)
    await db.commit()


async def _handle_transfer_event(data: dict, db: AsyncSession) -> None:
    tracking_id = str(data.get("tracking_id") or "")
    reference = str(data.get("api_ref") or data.get("reference") or "")
    state = str(data.get("state") or "").upper()
    status = state.lower()

    if not tracking_id and not reference:
        return

    query = select(Transaction).where(Transaction.transaction_type == TransactionType.withdrawal)
    if tracking_id:
        query = query.where(Transaction.provider_transaction_id == tracking_id)
    else:
        query = query.where(Transaction.provider_reference == reference)
    transaction = (await db.execute(query)).scalar_one_or_none()
    if not transaction:
        return

    transaction.provider_status = status or transaction.provider_status
    if tracking_id:
        transaction.provider_transaction_id = tracking_id

    if state in {"COMPLETE", "COMPLETED", "SUCCESSFUL"}:
        transaction.status = TransactionStatus.completed
    elif state in {"FAILED", "REVERSED", "CANCELLED"} and transaction.status == TransactionStatus.pending:
        repo = WalletRepository(db)
        wallet = await repo.get_by_id(transaction.wallet_id)
        if wallet:
            await repo.update_balance(wallet, balance_delta=float(transaction.amount_kes))
        transaction.status = TransactionStatus.failed
        transaction.description = f"{transaction.description or 'Withdrawal request'} — provider {status}"

    await db.commit()
