import logging
import uuid

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.currency import currency_for_user, flutterwave_payment_options_for_country
from app.core.exceptions import InsufficientFunds
from app.models.user import User
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


async def request_withdrawal(
    current_user: User,
    amount_kes: float,
    destination: str | None,
    db: AsyncSession,
    payout_details: dict | None = None,
) -> TransactionOut:
    if amount_kes <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be greater than zero")

    repo = WalletRepository(db)
    wallet = await _get_or_create_wallet(current_user, repo)
    if not wallet or float(wallet.balance_kes) < amount_kes:
        raise InsufficientFunds()

    reference = f"withdrawal-{uuid.uuid4()}"
    metadata = {
        "destination": destination,
        **(payout_details or {}),
    }
    transaction = await repo.create_transaction(
        wallet_id=wallet.id,
        shipment_id=None,
        transaction_type=TransactionType.withdrawal,
        amount_kes=amount_kes,
        status=TransactionStatus.pending,
        description=(
            f"Withdrawal request{(' to ' + destination) if destination else ''}"
        ),
        reference=reference,
        provider="flutterwave",
        provider_reference=reference,
        provider_status="pending_admin_approval",
        provider_metadata=metadata,
    )

    await repo.update_balance(wallet, balance_delta=-amount_kes)
    await db.commit()
    return TransactionOut.model_validate(transaction)


async def approve_withdrawal(
    transaction_id: uuid.UUID,
    db: AsyncSession,
    provider: str = "flutterwave",
    manual_reference: str | None = None,
) -> TransactionOut:
    transaction = await db.get(Transaction, transaction_id)
    if not transaction or transaction.transaction_type != TransactionType.withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal transaction not found")
    if transaction.status != TransactionStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending withdrawals can be approved")

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

    if provider != "flutterwave":
        raise HTTPException(status_code=400, detail="Unsupported payout provider")
    if not settings.flutterwave_secret_key:
        raise HTTPException(status_code=503, detail="Flutterwave is not configured")

    details = transaction.provider_metadata or {}
    account_bank = details.get("account_bank")
    account_number = details.get("account_number")
    if not account_bank or not account_number:
        raise HTTPException(status_code=400, detail="Withdrawal is missing payout account details")

    reference = transaction.provider_reference or transaction.reference or f"withdrawal-{transaction.id}"
    payload = {
        "account_bank": account_bank,
        "account_number": account_number,
        "amount": float(transaction.amount_kes),
        "currency": wallet.currency,
        "narration": details.get("narration") or "Trakvora wallet withdrawal",
        "reference": reference,
        "debit_currency": wallet.currency,
    }
    if settings.flutterwave_transfer_callback_url:
        payload["callback_url"] = settings.flutterwave_transfer_callback_url

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.flutterwave.com/v3/transfers",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.flutterwave_secret_key}",
                    "Content-Type": "application/json",
                },
            )
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Payout provider request failed: {exc}") from exc

    if response.status_code not in (200, 201) or data.get("status") != "success":
        transaction.provider_status = "provider_request_failed"
        await db.commit()
        raise HTTPException(
            status_code=502,
            detail=(data.get("message") or data.get("status") or "Unable to create transfer"),
        )

    transfer = data.get("data") or {}
    provider_status = str(transfer.get("status") or data.get("status") or "pending").lower()
    transaction.provider = "flutterwave"
    transaction.provider_reference = str(transfer.get("reference") or reference)
    transaction.provider_transaction_id = str(transfer.get("id") or "") or None
    transaction.provider_status = provider_status
    if provider_status in {"successful", "completed", "success"}:
        transaction.status = TransactionStatus.completed
    await db.commit()
    await db.refresh(transaction)
    return TransactionOut.model_validate(transaction)


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
    if amount_kes <= 0:
        raise HTTPException(status_code=400, detail="Top-up amount must be greater than zero")

    if not settings.flutterwave_secret_key:
        raise HTTPException(status_code=503, detail="Flutterwave is not configured")

    repo = WalletRepository(db)
    wallet = await _get_or_create_wallet(current_user, repo)

    tx_ref = f"trakvora-{uuid.uuid4()}"
    redirect_url = settings.flutterwave_redirect_url or (
        settings.cors_origins_list[0] if settings.cors_origins_list else "http://localhost:5173"
    )

    payload = {
        "tx_ref": tx_ref,
        "amount": round(amount_kes, 2),
        "currency": wallet.currency,
        "redirect_url": redirect_url,
        "payment_options": flutterwave_payment_options_for_country(current_user.country),
        "customer": {
            "email": current_user.email,
            "name": current_user.full_name,
        },
        "meta": {
            "user_id": str(current_user.id),
            "wallet_id": str(wallet.id),
            "purpose": "wallet_topup",
            "currency": wallet.currency,
            "country": current_user.country,
        },
        "customizations": {
            "title": "Trakvora wallet top-up",
            "description": "Load funds into your escrow wallet",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.flutterwave.com/v3/payments",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.flutterwave_secret_key}",
                    "Content-Type": "application/json",
                },
            )
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Payment provider request failed: {exc}") from exc

    if response.status_code != 200 or data.get("status") != "success":
        raise HTTPException(
            status_code=502,
            detail=(data.get("message") or data.get("status") or "Unable to create payment session"),
        )

    payment_url = data.get("data", {}).get("link")
    if not payment_url:
        raise HTTPException(status_code=502, detail="Payment provider did not return a payment link")

    await repo.create_transaction(
        wallet_id=wallet.id,
        shipment_id=None,
        transaction_type=TransactionType.top_up,
        amount_kes=amount_kes,
        status=TransactionStatus.pending,
        description="Pending wallet top-up via Flutterwave",
        reference=tx_ref,
        provider="flutterwave",
        provider_reference=tx_ref,
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
) -> None:
    """
    Release escrow on delivery confirmation.
    Deducts platform commission before paying out to owner.
    Commission rate and cap are loaded from PlatformConfig for the shipper's country.
    """
    from app.models.platform_config import PlatformConfig
    from app.models.user import User as UserModel
    from app.services import etims_service
    from sqlalchemy import select as sa_select

    repo = WalletRepository(db)

    # Load commission rate from DB based on shipper's country
    shipper_result = await db.execute(sa_select(UserModel).where(UserModel.id == shipper_user_id))
    shipper_user = shipper_result.scalar_one_or_none()
    country = (shipper_user.country or "KE").upper() if shipper_user else "KE"

    pc = (await db.execute(
        sa_select(PlatformConfig).where(
            PlatformConfig.country_code == country,
            PlatformConfig.service_type == "truck",
            PlatformConfig.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()

    commission_rate = float(
        pc.carrier_commission_rate if pc and pc.carrier_commission_rate is not None
        else (pc.commission_rate if pc else 0.07)
    )
    max_cap = float(pc.max_commission_kes) if pc and pc.max_commission_kes else None

    raw_fee = round(amount_kes * commission_rate, 2)
    if max_cap is not None:
        raw_fee = min(raw_fee, max_cap)
    platform_fee = max(raw_fee, 0.0)
    owner_payout = amount_kes - platform_fee

    shipper_wallet = await repo.get_by_user(shipper_user_id)
    if shipper_wallet:
        await repo.update_balance(shipper_wallet, balance_delta=0, escrow_delta=-amount_kes)
        await repo.create_transaction(
            wallet_id=shipper_wallet.id,
            shipment_id=shipment_id,
            transaction_type=TransactionType.escrow_release,
            amount_kes=amount_kes,
            status=TransactionStatus.completed,
            description="Escrow released on delivery",
        )
        if platform_fee > 0:
            fee_tx = await repo.create_transaction(
                wallet_id=shipper_wallet.id,
                shipment_id=shipment_id,
                transaction_type=TransactionType.platform_fee,
                amount_kes=platform_fee,
                status=TransactionStatus.completed,
                description=f"Platform commission ({round(commission_rate * 100, 1)}%)",
            )
            # Generate KRA eTIMS invoice for platform fee
            if shipper_user:
                await etims_service.process_and_store_invoice(fee_tx, shipper_user, db)

    owner_wallet = await repo.get_by_user(owner_user_id)
    if not owner_wallet:
        owner_wallet = await repo.create_wallet(owner_user_id, currency=shipper_wallet.currency if shipper_wallet else "KES")
    await repo.update_balance(owner_wallet, balance_delta=owner_payout)
    await repo.create_transaction(
        wallet_id=owner_wallet.id,
        shipment_id=shipment_id,
        transaction_type=TransactionType.payout,
        amount_kes=owner_payout,
        status=TransactionStatus.completed,
        description="Payment received for completed delivery",
    )
