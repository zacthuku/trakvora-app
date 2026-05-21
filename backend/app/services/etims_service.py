"""
KRA eTIMS (Electronic Tax Invoice Management System) service.

Handles authentication, invoice construction, and real-time submission to KRA.
Only platform_fee and subscription_fee transactions generate eTIMS invoices.

Sandbox: https://etims-api-sbx.kra.go.ke
Production: https://etims-api.kra.go.ke
"""

import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.etims import EtimsInvoice, EtimsInvoiceStatus, EtimsInvoiceType
from app.models.user import User
from app.models.wallet import Transaction, TransactionType
from app.schemas.etims import EtimsInvoicePayload, EtimsItemPayload

logger = logging.getLogger(__name__)

# UN SPSC item classification codes
_ITEM_CODE_PLATFORM_FEE = "78101800"    # Freight transportation arrangement services
_ITEM_CODE_SUBSCRIPTION = "43232100"    # Business intelligence / SaaS software

# Cached auth token (module-level, reset on expiry or process restart)
_cached_token: str | None = None
_token_expires_at: datetime | None = None


async def _get_auth_token() -> str | None:
    """Authenticate with KRA eTIMS and return a bearer token. Returns None if eTIMS is not configured."""
    global _cached_token, _token_expires_at

    if not settings.etims_enabled:
        return None

    now = datetime.now(timezone.utc)
    if _cached_token and _token_expires_at and now < _token_expires_at:
        return _cached_token

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{settings.etims_base_url}/selectInitOsdcInfo",
                json={
                    "tpin": settings.kra_pin,
                    "bhfId": settings.etims_branch_id,
                    "dvcSrlNo": f"VSCU-{settings.kra_pin}",
                },
                auth=(settings.etims_username, settings.etims_password),
            )
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.error("eTIMS auth request failed: %s", exc)
        return None

    if data.get("resultCd") != "000":
        logger.error("eTIMS auth error: %s — %s", data.get("resultCd"), data.get("resultMsg"))
        return None

    token = (data.get("data") or {}).get("authToken") or (data.get("data") or {}).get("token")
    if token:
        _cached_token = token
        # KRA tokens typically expire in 1 hour; cache for 50 minutes to be safe
        from datetime import timedelta
        _token_expires_at = now + timedelta(minutes=50)
        return token

    # Some eTIMS implementations use Basic auth on every request (no token)
    # Fall back to returning a sentinel so callers know auth succeeded
    _cached_token = "__basic_auth__"
    from datetime import timedelta
    _token_expires_at = now + timedelta(minutes=50)
    return _cached_token


def _build_auth_headers(token: str) -> dict:
    if token == "__basic_auth__":
        import base64
        credentials = base64.b64encode(
            f"{settings.etims_username}:{settings.etims_password}".encode()
        ).decode()
        return {"Authorization": f"Basic {credentials}", "Content-Type": "application/json"}
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _next_invoice_number(db: AsyncSession) -> str:
    """Generate the next sequential Trakvora invoice number: TRV-YYYY-NNNNNN."""
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        select(func.count()).select_from(EtimsInvoice)
    )
    count = (result.scalar() or 0) + 1
    return f"TRV-{year}-{count:06d}"


def _compute_vat(total_amount: float, vat_rate: float = None) -> tuple[float, float]:
    """
    Given a VAT-inclusive total, return (taxable_amount, vat_amount).
    Both rounded to 2 decimal places.
    """
    rate = vat_rate if vat_rate is not None else settings.vat_rate
    taxable = round(total_amount / (1 + rate), 2)
    vat = round(total_amount - taxable, 2)
    return taxable, vat


def _build_platform_fee_payload(
    invoice_no: str,
    seller_pin: str,
    buyer_name: str,
    buyer_pin: str | None,
    total_amount: float,
    shipment_ref: str | None,
    branch_id: str = "00",
) -> EtimsInvoicePayload:
    taxable, vat = _compute_vat(total_amount)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    remark = f"Platform commission fee" + (f" — {shipment_ref}" if shipment_ref else "")

    item = EtimsItemPayload(
        itemSeq=1,
        itemCd="SRV-PLATFORM-FEE",
        itemClsCd=_ITEM_CODE_PLATFORM_FEE,
        itemNm="Freight Platform Service Fee",
        qty=1,
        prc=taxable,
        splyAmt=taxable,
        taxblAmt=taxable,
        taxAmt=vat,
        totAmt=total_amount,
    )

    return EtimsInvoicePayload(
        tpin=seller_pin,
        bhfId=branch_id,
        cisInvcNo=invoice_no,
        custTpin=buyer_pin,
        custNm=buyer_name,
        cfmDt=today,
        salesDt=today,
        taxblAmtA=taxable,
        taxAmtA=vat,
        totTaxblAmt=taxable,
        totTaxAmt=vat,
        totAmt=total_amount,
        remark=remark,
        itemList=[item],
    )


def _build_subscription_payload(
    invoice_no: str,
    seller_pin: str,
    buyer_name: str,
    buyer_pin: str | None,
    total_amount: float,
    plan_name: str,
    branch_id: str = "00",
) -> EtimsInvoicePayload:
    taxable, vat = _compute_vat(total_amount)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")

    item = EtimsItemPayload(
        itemSeq=1,
        itemCd="SRV-SUBSCRIPTION",
        itemClsCd=_ITEM_CODE_SUBSCRIPTION,
        itemNm=f"Platform Subscription — {plan_name}",
        qty=1,
        prc=taxable,
        splyAmt=taxable,
        taxblAmt=taxable,
        taxAmt=vat,
        totAmt=total_amount,
    )

    return EtimsInvoicePayload(
        tpin=seller_pin,
        bhfId=branch_id,
        cisInvcNo=invoice_no,
        custTpin=buyer_pin,
        custNm=buyer_name,
        cfmDt=today,
        salesDt=today,
        taxblAmtA=taxable,
        taxAmtA=vat,
        totTaxblAmt=taxable,
        totTaxAmt=vat,
        totAmt=total_amount,
        remark=f"Subscription: {plan_name}",
        itemList=[item],
    )


async def _submit_to_kra(
    payload: EtimsInvoicePayload,
    token: str,
) -> dict:
    """POST invoice to KRA eTIMS. Returns the full JSON response dict."""
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{settings.etims_base_url}/insertTrnsSaleRlqst",
                json=payload.model_dump(),
                headers=_build_auth_headers(token),
            )
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return {"resultCd": "NETWORK_ERROR", "resultMsg": str(exc)}


async def process_and_store_invoice(
    transaction: Transaction,
    user: User,
    db: AsyncSession,
    plan_name: str | None = None,
) -> EtimsInvoice | None:
    """
    Build, submit to KRA, and persist an eTIMS invoice for a taxable transaction.

    Call this immediately after creating a platform_fee or subscription_fee transaction.
    Returns the stored EtimsInvoice record (status may be 'failed' if KRA is unavailable).
    Returns None if eTIMS is not configured (no credentials set).
    """
    if not settings.etims_enabled:
        logger.debug("eTIMS not configured — skipping invoice for tx %s", transaction.id)
        return None

    if transaction.transaction_type not in (
        TransactionType.platform_fee,
        TransactionType.subscription_fee,
    ):
        return None

    invoice_no = await _next_invoice_number(db)
    total_amount = float(transaction.amount_kes)
    taxable, vat = _compute_vat(total_amount)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    buyer_name = user.full_name or user.email
    is_subscription = transaction.transaction_type == TransactionType.subscription_fee
    invoice_type = EtimsInvoiceType.subscription if is_subscription else EtimsInvoiceType.platform_fee
    description = transaction.description or (
        "Platform Subscription" if is_subscription else "Freight Platform Service Fee"
    )

    record = EtimsInvoice(
        id=uuid.uuid4(),
        transaction_id=transaction.id,
        internal_invoice_no=invoice_no,
        invoice_date=today,
        seller_pin=settings.kra_pin,
        buyer_pin=getattr(user, "kra_pin", None),
        buyer_name=buyer_name,
        buyer_email=user.email,
        taxable_amount_kes=taxable,
        vat_amount_kes=vat,
        total_amount_kes=total_amount,
        status=EtimsInvoiceStatus.pending,
        service_description=description,
        invoice_type=invoice_type,
    )
    db.add(record)
    await db.flush()  # get record persisted before calling KRA

    # Build KRA payload
    if is_subscription:
        payload = _build_subscription_payload(
            invoice_no=invoice_no,
            seller_pin=settings.kra_pin,
            buyer_name=buyer_name,
            buyer_pin=record.buyer_pin,
            total_amount=total_amount,
            plan_name=plan_name or description,
            branch_id=settings.etims_branch_id,
        )
    else:
        payload = _build_platform_fee_payload(
            invoice_no=invoice_no,
            seller_pin=settings.kra_pin,
            buyer_name=buyer_name,
            buyer_pin=record.buyer_pin,
            total_amount=total_amount,
            shipment_ref=str(transaction.shipment_id) if transaction.shipment_id else None,
            branch_id=settings.etims_branch_id,
        )

    # Authenticate and submit
    token = await _get_auth_token()
    if not token:
        record.status = EtimsInvoiceStatus.failed
        record.last_error = "eTIMS authentication failed"
        return record

    record.status = EtimsInvoiceStatus.submitted
    kra_response = await _submit_to_kra(payload, token)
    record.kra_response = kra_response

    result_code = kra_response.get("resultCd")
    if result_code == "000":
        data = kra_response.get("data") or {}
        record.status = EtimsInvoiceStatus.accepted
        record.cu_invoice_no = data.get("cuInvcNo") or data.get("cisInvcNo")
        record.receipt_signature = data.get("rcptSign") or data.get("intrlData")
        record.qr_code_url = data.get("qrCode")
        record.kra_submission_date = kra_response.get("resultDt") or datetime.now(timezone.utc).isoformat()
    else:
        record.status = EtimsInvoiceStatus.failed
        record.last_error = f"[{result_code}] {kra_response.get('resultMsg', 'Unknown KRA error')}"
        logger.warning("eTIMS submission failed for invoice %s: %s", invoice_no, record.last_error)

    return record


async def retry_failed_invoice(invoice: EtimsInvoice, db: AsyncSession) -> None:
    """Re-attempt KRA submission for a single failed EtimsInvoice record."""
    if not settings.etims_enabled:
        return

    token = await _get_auth_token()
    if not token:
        invoice.retry_count += 1
        invoice.last_error = "eTIMS authentication failed on retry"
        return

    # Rebuild the same payload from stored data
    taxable = float(invoice.taxable_amount_kes)
    vat = float(invoice.vat_amount_kes)
    total = float(invoice.total_amount_kes)

    if invoice.invoice_type == EtimsInvoiceType.subscription:
        payload = _build_subscription_payload(
            invoice_no=invoice.internal_invoice_no,
            seller_pin=invoice.seller_pin,
            buyer_name=invoice.buyer_name,
            buyer_pin=invoice.buyer_pin,
            total_amount=total,
            plan_name=invoice.service_description,
            branch_id=settings.etims_branch_id,
        )
    else:
        payload = _build_platform_fee_payload(
            invoice_no=invoice.internal_invoice_no,
            seller_pin=invoice.seller_pin,
            buyer_name=invoice.buyer_name,
            buyer_pin=invoice.buyer_pin,
            total_amount=total,
            shipment_ref=None,
            branch_id=settings.etims_branch_id,
        )

    invoice.status = EtimsInvoiceStatus.submitted
    invoice.retry_count += 1
    kra_response = await _submit_to_kra(payload, token)
    invoice.kra_response = kra_response

    result_code = kra_response.get("resultCd")
    if result_code == "000":
        data = kra_response.get("data") or {}
        invoice.status = EtimsInvoiceStatus.accepted
        invoice.cu_invoice_no = data.get("cuInvcNo") or data.get("cisInvcNo")
        invoice.receipt_signature = data.get("rcptSign") or data.get("intrlData")
        invoice.qr_code_url = data.get("qrCode")
        invoice.kra_submission_date = kra_response.get("resultDt") or datetime.now(timezone.utc).isoformat()
        invoice.last_error = None
    else:
        invoice.status = EtimsInvoiceStatus.failed
        invoice.last_error = f"[{result_code}] {kra_response.get('resultMsg', 'Unknown KRA error')}"
