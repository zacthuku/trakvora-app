import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.services import reporting_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _require_owner_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.owner, UserRole.admin, UserRole.shipper):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user


@router.get("/trip/{shipment_id}")
async def trip_report(
    shipment_id: uuid.UUID,
    current_user: User = Depends(_require_owner_or_admin),
    db: AsyncSession = Depends(get_db),
):
    return await reporting_service.generate_trip_report(str(shipment_id), db)


@router.get("/fleet")
async def fleet_report(
    current_user: User = Depends(_require_owner_or_admin),
    db: AsyncSession = Depends(get_db),
):
    return await reporting_service.generate_fleet_report(str(current_user.id), db)


@router.get("/analytics")
async def platform_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    return await reporting_service.generate_platform_analytics(db, days=days)


@router.get("/advanced-analytics")
async def advanced_company_analytics(
    company_id: str = Query(..., description="Company ID for analytics"),
    days: int = Query(90, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Advanced analytics with trends, OTIF, and corridor data for dashboard charts."""
    # Allow company members or admins to access
    if current_user.role != UserRole.admin:
        from app.models.company import CompanyMember
        member_result = await db.execute(
            select(CompanyMember).where(
                CompanyMember.company_id == company_id,
                CompanyMember.user_id == current_user.id,
                CompanyMember.is_active == True,
            )
        )
        if not member_result.scalar():
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Access denied")

    return await reporting_service.generate_advanced_company_analytics(company_id, db, days)


@router.get("/operational-alerts")
async def operational_alerts(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    return await reporting_service.generate_operational_alerts(db, days)


@router.get("/shipments.csv")
async def export_shipments_csv(
    current_user: User = Depends(_require_owner_or_admin),
    db: AsyncSession = Depends(get_db),
):
    owner_id = None if current_user.role == UserRole.admin else str(current_user.id)
    csv_data = await reporting_service.export_shipments_csv(owner_id, db)
    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=shipments.csv"},
    )


@router.get("/shipments.pdf")
async def export_shipments_pdf(
    current_user: User = Depends(_require_owner_or_admin),
    db: AsyncSession = Depends(get_db),
):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from app.models.load import Load, LoadStatus
    from app.models.shipment import Shipment

    # Fetch shipments
    q = select(Shipment, Load).join(Load, Shipment.load_id == Load.id)
    if current_user.role != UserRole.admin:
        q = q.where(Load.shipper_id == current_user.id)
    q = q.order_by(Shipment.delivered_at.desc().nullslast()).limit(200)
    result = await db.execute(q)
    rows = result.all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("trakvora", styles["Title"]))
    story.append(Paragraph(f"Shipment Report — {date.today().strftime('%d %b %Y')}", styles["Normal"]))
    story.append(Paragraph(f"Account: {current_user.full_name}", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    headers = ["#", "Route", "Date", "Cargo", "Weight (t)", "Amount (KES)", "Status"]
    table_data = [headers]
    for i, (shipment, load) in enumerate(rows, 1):
        delivered = shipment.delivered_at.strftime("%d/%m/%Y") if shipment.delivered_at else (load.pickup_date or "—")
        table_data.append([
            str(i),
            f"{load.pickup_location[:20]} → {load.dropoff_location[:20]}",
            delivered,
            str(load.cargo_type).replace("CargoType.", ""),
            str(load.weight_tonnes),
            f"{float(load.price_kes):,.0f}",
            str(shipment.status).replace("LoadStatus.", ""),
        ])

    col_widths = [0.8 * cm, 7 * cm, 2.2 * cm, 2.5 * cm, 2 * cm, 2.8 * cm, 2 * cm]
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    doc.build(story)

    pdf_bytes = buf.getvalue()
    today = date.today().isoformat()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=trakvora-shipments-{today}.pdf"},
    )


@router.get("/shipments/{shipment_id}/invoice.pdf")
async def export_invoice_pdf(
    shipment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from app.models.load import Load
    from app.models.shipment import Shipment

    result = await db.execute(
        select(Shipment, Load).join(Load, Shipment.load_id == Load.id).where(Shipment.id == shipment_id)
    )
    row = result.first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shipment not found")
    shipment, load = row

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("trakvora", styles["Title"]))
    story.append(Paragraph("Invoice / Shipment Summary", styles["Heading2"]))
    story.append(Spacer(1, 0.4 * cm))

    # Look up VAT rate for the shipper's country
    from app.models.country_config import CountryConfig
    from app.models.user import User as UserModel
    shipper_result = await db.execute(select(UserModel).where(UserModel.id == load.shipper_id))
    shipper = shipper_result.scalar_one_or_none()
    shipper_country = (shipper.country if shipper else None) or "KE"
    cc = (await db.execute(
        select(CountryConfig).where(CountryConfig.country_code == shipper_country.upper())
    )).scalar_one_or_none()
    vat_rate = float(cc.vat_rate) if cc else 0.16
    price = float(load.price_kes)
    vat_amount = round(price * vat_rate, 2)
    total_with_vat = round(price + vat_amount, 2)

    delivered = shipment.delivered_at.strftime("%d %b %Y") if shipment.delivered_at else "In progress"
    detail_rows = [
        ["Shipment ID", str(shipment.id)],
        ["Status", str(shipment.status).replace("LoadStatus.", "").title()],
        ["From", load.pickup_location],
        ["To", load.dropoff_location],
        ["Cargo", f"{load.cargo_type} — {load.weight_tonnes}t"],
        ["Pickup Date", load.pickup_date or "—"],
        ["Delivered", delivered],
        ["Subtotal (KES)", f"{price:,.2f}"],
        [f"VAT ({vat_rate * 100:.0f}%)", f"{vat_amount:,.2f}"],
        ["Total incl. VAT (KES)", f"{total_with_vat:,.2f}"],
    ]
    t = Table(detail_rows, colWidths=[4 * cm, 13 * cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Generated by trakvora — www.trakvora.com", styles["Normal"]))

    doc.build(story)
    pdf_bytes = buf.getvalue()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice-{shipment_id}.pdf"},
    )
