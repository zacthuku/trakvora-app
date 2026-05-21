import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.etims import EtimsInvoice, EtimsInvoiceStatus
from app.models.user import User
from app.models.wallet import Transaction
from app.repositories.wallet_repo import WalletRepository
from app.schemas.etims import EtimsInvoiceListOut, EtimsInvoiceOut
from app.services import etims_service

router = APIRouter(prefix="/etims", tags=["etims"])


@router.get("/invoices", response_model=EtimsInvoiceListOut)
async def list_my_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all KRA eTIMS tax invoices issued to the current user."""
    repo = WalletRepository(db)
    wallet = await repo.get_by_user(current_user.id)
    if not wallet:
        return EtimsInvoiceListOut(items=[], total=0, page=page, page_size=page_size)

    # Get transaction IDs belonging to this user's wallet
    tx_result = await db.execute(
        select(Transaction.id).where(Transaction.wallet_id == wallet.id)
    )
    tx_ids = [row[0] for row in tx_result.fetchall()]
    if not tx_ids:
        return EtimsInvoiceListOut(items=[], total=0, page=page, page_size=page_size)

    offset = (page - 1) * page_size
    total_result = await db.execute(
        select(func.count()).select_from(EtimsInvoice).where(EtimsInvoice.transaction_id.in_(tx_ids))
    )
    total = total_result.scalar() or 0

    items_result = await db.execute(
        select(EtimsInvoice)
        .where(EtimsInvoice.transaction_id.in_(tx_ids))
        .order_by(EtimsInvoice.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items = items_result.scalars().all()

    return EtimsInvoiceListOut(
        items=[EtimsInvoiceOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/invoices/{invoice_id}", response_model=EtimsInvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single eTIMS invoice. Users can only access their own invoices."""
    invoice = await db.get(EtimsInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Verify ownership via wallet → transaction chain
    repo = WalletRepository(db)
    wallet = await repo.get_by_user(current_user.id)
    tx = await db.get(Transaction, invoice.transaction_id)
    if not wallet or not tx or tx.wallet_id != wallet.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return EtimsInvoiceOut.model_validate(invoice)


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a KRA-compliant tax invoice PDF with CUIN and QR code."""
    invoice = await db.get(EtimsInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    repo = WalletRepository(db)
    wallet = await repo.get_by_user(current_user.id)
    tx = await db.get(Transaction, invoice.transaction_id)
    if not wallet or not tx or tx.wallet_id != wallet.id:
        raise HTTPException(status_code=403, detail="Access denied")

    pdf_bytes = _generate_invoice_pdf(invoice)
    filename = f"trakvora-receipt-{invoice.internal_invoice_no}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/admin/invoices", response_model=EtimsInvoiceListOut)
async def admin_list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: str | None = Query(None, description="Filter by status: pending, submitted, accepted, failed"),
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all eTIMS invoices across all users."""
    offset = (page - 1) * page_size
    base_filter = []
    if status:
        try:
            status_enum = EtimsInvoiceStatus(status)
            base_filter.append(EtimsInvoice.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    total_result = await db.execute(
        select(func.count()).select_from(EtimsInvoice).where(*base_filter)
    )
    total = total_result.scalar() or 0

    items_result = await db.execute(
        select(EtimsInvoice)
        .where(*base_filter)
        .order_by(EtimsInvoice.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items = items_result.scalars().all()

    return EtimsInvoiceListOut(
        items=[EtimsInvoiceOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/admin/invoices/{invoice_id}/retry", response_model=EtimsInvoiceOut)
async def admin_retry_invoice(
    invoice_id: uuid.UUID,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: manually retry a failed eTIMS submission to KRA."""
    invoice = await db.get(EtimsInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == EtimsInvoiceStatus.accepted:
        raise HTTPException(status_code=400, detail="Invoice already accepted by KRA")

    await etims_service.retry_failed_invoice(invoice, db)
    await db.commit()
    await db.refresh(invoice)
    return EtimsInvoiceOut.model_validate(invoice)


# ── PDF generation ─────────────────────────────────────────────────────────────

def _generate_invoice_pdf(invoice: EtimsInvoice) -> bytes:
    """Generate a KRA-compliant tax invoice PDF using reportlab."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    except ImportError:
        # reportlab not installed — return minimal plain-text PDF placeholder
        return _fallback_text_pdf(invoice)

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    bold = ParagraphStyle("bold", parent=styles["Normal"], fontName="Helvetica-Bold")
    story = []

    # Header
    story.append(Paragraph("TAX INVOICE", ParagraphStyle("h1", parent=styles["Heading1"], alignment=1)))
    story.append(Paragraph("Trakvora Limited", bold))
    story.append(Paragraph(f"KRA PIN: {invoice.seller_pin}", styles["Normal"]))
    story.append(Spacer(1, 0.3*cm))

    # Invoice details table
    details = [
        ["Invoice No:", invoice.internal_invoice_no],
        ["Invoice Date:", invoice.invoice_date],
        ["KRA CUIN:", invoice.cu_invoice_no or "Pending KRA acceptance"],
        ["Bill To:", invoice.buyer_name],
    ]
    if invoice.buyer_pin:
        details.append(["Customer PIN:", invoice.buyer_pin])
    if invoice.buyer_email:
        details.append(["Email:", invoice.buyer_email])

    details_table = Table(details, colWidths=[4*cm, 12*cm])
    details_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 0.5*cm))

    # Line items
    items_data = [
        ["Description", "Qty", "Unit Price (KES)", "VAT (16%)", "Total (KES)"],
        [
            invoice.service_description,
            "1",
            f"{float(invoice.taxable_amount_kes):,.2f}",
            f"{float(invoice.vat_amount_kes):,.2f}",
            f"{float(invoice.total_amount_kes):,.2f}",
        ],
    ]
    items_table = Table(items_data, colWidths=[7*cm, 1.5*cm, 3.5*cm, 2.5*cm, 3.5*cm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 0.3*cm))

    # Totals
    totals_data = [
        ["Taxable Amount (ex-VAT):", f"KES {float(invoice.taxable_amount_kes):,.2f}"],
        ["VAT (16%):", f"KES {float(invoice.vat_amount_kes):,.2f}"],
        ["TOTAL:", f"KES {float(invoice.total_amount_kes):,.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[10*cm, 6*cm])
    totals_table.setStyle(TableStyle([
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, 2), (-1, 2), 1, colors.black),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 0.5*cm))

    # KRA verification
    if invoice.cu_invoice_no:
        story.append(Paragraph(
            f"<b>KRA Control Unit Invoice No (CUIN):</b> {invoice.cu_invoice_no}", styles["Normal"]
        ))
    if invoice.qr_code_url:
        story.append(Paragraph(
            f"Verify this invoice at: {invoice.qr_code_url}", styles["Normal"]
        ))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "This is a KRA eTIMS compliant tax invoice. "
        "Trakvora Limited is registered for VAT in Kenya (16%).",
        ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
    ))

    doc.build(story)
    return buf.getvalue()


def _fallback_text_pdf(invoice: EtimsInvoice) -> bytes:
    """Minimal PDF when reportlab is unavailable."""
    lines = [
        "TAX INVOICE",
        f"Invoice No: {invoice.internal_invoice_no}",
        f"Date: {invoice.invoice_date}",
        f"KRA CUIN: {invoice.cu_invoice_no or 'Pending'}",
        f"Bill To: {invoice.buyer_name}",
        f"Description: {invoice.service_description}",
        f"Taxable Amount: KES {float(invoice.taxable_amount_kes):,.2f}",
        f"VAT (16%): KES {float(invoice.vat_amount_kes):,.2f}",
        f"TOTAL: KES {float(invoice.total_amount_kes):,.2f}",
    ]
    content = "\n".join(lines).encode("utf-8")
    # Bare-minimum valid PDF with plain text
    pdf = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>"
        b"/Contents 4 0 R>>endobj\n"
        + b"4 0 obj<</Length " + str(len(content)).encode() + b">>\nstream\n"
        + content + b"\nendstream\nendobj\nxref\n0 5\n"
        b"0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n"
        b"0000000115 00000 n\n0000000266 00000 n\ntrailer<</Size 5/Root 1 0 R>>\n"
        b"startxref\n" + str(300 + len(content)).encode() + b"\n%%EOF"
    )
    return pdf
