"""
Scheduled Report management — subscribe to periodic fleet/shipment/analytics reports.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.scheduled_report import ReportFrequency, ScheduledReport
from app.models.user import User

router = APIRouter(prefix="/scheduled-reports", tags=["reports"])

_ALLOWED_REPORT_TYPES = {"fleet", "shipments", "analytics"}


class ScheduledReportCreate(BaseModel):
    report_type: str
    frequency: ReportFrequency = ReportFrequency.weekly
    email_to: str | None = None


class ScheduledReportUpdate(BaseModel):
    frequency: ReportFrequency | None = None
    email_to: str | None = None
    is_active: bool | None = None


class ScheduledReportOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    user_id: uuid.UUID
    report_type: str
    frequency: ReportFrequency
    email_to: str | None
    last_sent_at: datetime | None
    is_active: bool
    created_at: datetime


@router.post("", response_model=ScheduledReportOut, status_code=201)
async def create_scheduled_report(
    payload: ScheduledReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.report_type not in _ALLOWED_REPORT_TYPES:
        raise HTTPException(status_code=422, detail=f"report_type must be one of {sorted(_ALLOWED_REPORT_TYPES)}")
    report = ScheduledReport(
        user_id=current_user.id,
        report_type=payload.report_type,
        frequency=payload.frequency,
        email_to=payload.email_to,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("", response_model=list[ScheduledReportOut])
async def list_my_scheduled_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScheduledReport)
        .where(ScheduledReport.user_id == current_user.id)
        .order_by(ScheduledReport.created_at.desc())
    )
    return result.scalars().all()


@router.patch("/{report_id}", response_model=ScheduledReportOut)
async def update_scheduled_report(
    report_id: uuid.UUID,
    payload: ScheduledReportUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = (await db.execute(
        select(ScheduledReport).where(
            ScheduledReport.id == report_id,
            ScheduledReport.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    if payload.frequency is not None:
        report.frequency = payload.frequency
    if payload.email_to is not None:
        report.email_to = payload.email_to
    if payload.is_active is not None:
        report.is_active = payload.is_active
    await db.commit()
    await db.refresh(report)
    return report


@router.delete("/{report_id}", status_code=204)
async def delete_scheduled_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = (await db.execute(
        select(ScheduledReport).where(
            ScheduledReport.id == report_id,
            ScheduledReport.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    await db.delete(report)
    await db.commit()
