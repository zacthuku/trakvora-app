import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin_role
from app.models.compliance_review import ComplianceReview, ReviewDecision
from app.models.inspection_task import InspectionTask, TaskStatus
from app.models.truck import InspectionStatus, Truck
from app.models.user import AdminRole, User
from app.models.vehicle_inspection import VehicleInspection
from app.schemas.field_ops import ReviewOut, ReviewSubmit

router = APIRouter(prefix="/admin/compliance", tags=["compliance"])


# Literal routes MUST come before /{inspection_id}/review to avoid path-param capture

@router.get("/pending")
async def list_pending_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.compliance_officer)),
):
    reviewed_ids_subq = select(ComplianceReview.inspection_id)
    q = (
        select(VehicleInspection)
        .where(
            VehicleInspection.id.not_in(reviewed_ids_subq),
            VehicleInspection.submitted_at.is_not(None),
        )
    )
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(VehicleInspection.submitted_at.asc())
         .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    from app.schemas.field_ops import InspectionOut
    return {"total": total, "page": page, "limit": limit, "items": [InspectionOut.model_validate(r) for r in rows]}


@router.get("/history")
async def review_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.compliance_officer, AdminRole.operations_admin)),
):
    total = await db.scalar(select(func.count()).select_from(select(ComplianceReview).subquery()))
    rows = (await db.execute(
        select(ComplianceReview)
        .order_by(ComplianceReview.reviewed_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return {"total": total, "page": page, "limit": limit, "items": [ReviewOut.model_validate(r) for r in rows]}


@router.post("/{inspection_id}/review", response_model=ReviewOut, status_code=201)
async def submit_review(
    inspection_id: uuid.UUID,
    payload: ReviewSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role(AdminRole.compliance_officer)),
):
    insp = (await db.execute(select(VehicleInspection).where(VehicleInspection.id == inspection_id))).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")

    review = ComplianceReview(
        inspection_id=inspection_id,
        reviewer_id=current_user.id,
        decision=payload.decision,
        notes=payload.notes,
        reviewed_at=datetime.now(timezone.utc),
    )
    db.add(review)

    truck = (await db.execute(select(Truck).where(Truck.id == insp.truck_id))).scalar_one_or_none()
    task = (await db.execute(select(InspectionTask).where(InspectionTask.id == insp.task_id))).scalar_one_or_none()

    if payload.decision == ReviewDecision.approved:
        if truck:
            truck.is_verified = True
            truck.verified_at = datetime.now(timezone.utc)
            truck.verification_score = float(insp.score) if insp.score else None
            truck.inspection_status = InspectionStatus.approved
        if task:
            task.status = TaskStatus.completed
    elif payload.decision == ReviewDecision.rejected:
        if truck:
            truck.inspection_status = InspectionStatus.rejected
        if task:
            task.status = TaskStatus.completed
    elif payload.decision == ReviewDecision.re_inspection:
        if truck:
            truck.inspection_status = InspectionStatus.re_inspection
        if task:
            task.status = TaskStatus.pending

    await db.commit()
    await db.refresh(review)
    return review
