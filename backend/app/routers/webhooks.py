"""
Flutterwave webhook handler.

Flutterwave sends signed POST requests to this endpoint for payment events.
Signature: X-Flutterwave-Signature header (HMAC-SHA256 of request body using secret key).

Events handled:
  charge.completed   → top up user wallet on successful payment
  subscription.cancelled → mark subscription as cancelled
"""
import hashlib
import hmac
import uuid

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType
from app.repositories.wallet_repo import WalletRepository

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_hmac_signature(body: bytes, signature: str) -> bool:
    secret = getattr(settings, "flutterwave_secret_key", "")
    if not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _verify_verif_hash(verif_hash: str | None) -> bool:
    secret = getattr(settings, "flutterwave_webhook_secret", "") or getattr(settings, "flutterwave_secret_hash", "")
    return bool(secret and verif_hash and hmac.compare_digest(secret, verif_hash))


async def _verify_flutterwave_transaction(transaction_id: str | int | None) -> dict | None:
    if not transaction_id or not settings.flutterwave_secret_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify",
                headers={"Authorization": f"Bearer {settings.flutterwave_secret_key}"},
            )
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        return None
    if response.status_code != 200 or payload.get("status") != "success":
        return None
    return payload.get("data") or {}


@router.post("/flutterwave")
async def flutterwave_webhook(
    request: Request,
    verif_hash: str = Header(None, alias="verif-hash"),
    x_flutterwave_signature: str = Header(None, alias="x-flutterwave-signature"),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    signature_ok = _verify_hmac_signature(body, x_flutterwave_signature or "") or _verify_verif_hash(verif_hash)

    if settings.environment == "production" and not signature_ok:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        import json
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event", "")
    data = payload.get("data", {})

    if event == "charge.completed" and data.get("status") == "successful":
        verified = await _verify_flutterwave_transaction(data.get("id") or data.get("transaction_id"))
        if settings.environment == "production" and not verified:
            raise HTTPException(status_code=502, detail="Unable to verify Flutterwave transaction")
        if verified:
            data = {**data, **verified}
        await _handle_charge_completed(data, db)
    elif event in ("transfer.completed", "transfer.failed", "transfer.reversed"):
        await _handle_transfer_event(data, db)
    elif event in ("subscription.cancelled", "subscription.deactivated"):
        await _handle_subscription_cancelled(data, db)

    return {"status": "ok"}


async def _handle_charge_completed(data: dict, db: AsyncSession) -> None:
    """Credit the user's wallet on a successful top-up charge."""
    meta = data.get("meta", {}) or {}
    user_id_str = meta.get("user_id") or data.get("customer", {}).get("email")
    amount = float(data.get("amount", 0))
    currency = data.get("currency")
    tx_ref = data.get("tx_ref") or data.get("flw_ref", "")

    if not user_id_str or amount <= 0:
        return

    # Resolve user — meta.user_id is preferred (UUID), fallback to email
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

    existing = await repo.get_transaction_by_reference(tx_ref)
    if existing and existing.status == TransactionStatus.completed:
        return

    if existing:
        expected_amount = float(existing.amount_kes)
        if round(expected_amount, 2) != round(amount, 2):
            existing.status = TransactionStatus.failed
            existing.description = f"Flutterwave amount mismatch for ref: {tx_ref}"
            await db.commit()
            return

    if wallet.currency and currency and wallet.currency != currency:
        if existing:
            existing.status = TransactionStatus.failed
            existing.description = f"Flutterwave currency mismatch for ref: {tx_ref}"
            await db.commit()
        return

    await repo.update_balance(wallet, balance_delta=amount)

    if existing:
        existing.status = TransactionStatus.completed
        existing.transaction_type = TransactionType.top_up
        existing.description = f"Wallet top-up via Flutterwave (ref: {tx_ref})"
        existing.amount_kes = amount
        await db.flush()
    else:
        await repo.create_transaction(
            wallet_id=wallet.id,
            shipment_id=None,
            transaction_type=TransactionType.top_up,
            amount_kes=amount,
            status=TransactionStatus.completed,
            description=f"Wallet top-up via Flutterwave (ref: {tx_ref})",
            reference=tx_ref,
        )

    await db.commit()


async def _handle_transfer_event(data: dict, db: AsyncSession) -> None:
    reference = data.get("reference") or data.get("tx_ref")
    transfer_id = str(data.get("id") or data.get("transfer_id") or "")
    status = str(data.get("status") or "").lower()
    if not reference and not transfer_id:
        return

    query = select(Transaction).where(Transaction.transaction_type == TransactionType.withdrawal)
    if reference:
        query = query.where(Transaction.provider_reference == str(reference))
    else:
        query = query.where(Transaction.provider_transaction_id == transfer_id)
    transaction = (await db.execute(query)).scalar_one_or_none()
    if not transaction:
        return

    transaction.provider_status = status or transaction.provider_status
    if transfer_id:
        transaction.provider_transaction_id = transfer_id

    if status in {"successful", "completed", "success"}:
        transaction.status = TransactionStatus.completed
    elif status in {"failed", "reversed", "cancelled"} and transaction.status == TransactionStatus.pending:
        repo = WalletRepository(db)
        wallet = await repo.get_by_id(transaction.wallet_id)
        if wallet:
            await repo.update_balance(wallet, balance_delta=float(transaction.amount_kes))
        transaction.status = TransactionStatus.failed
        transaction.description = f"{transaction.description or 'Withdrawal request'} — provider {status}"

    await db.commit()


async def _handle_subscription_cancelled(data: dict, db: AsyncSession) -> None:
    """Mark the matching Subscription record as cancelled."""
    flw_sub_id = str(data.get("id", ""))
    if not flw_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.flutterwave_subscription_id == flw_sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub and sub.status != SubscriptionStatus.cancelled:
        from datetime import datetime, timezone
        sub.status = SubscriptionStatus.cancelled
        sub.cancelled_at = datetime.now(timezone.utc)
        await db.commit()
