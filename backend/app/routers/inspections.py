import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin_role
from app.models.inspection_task import InspectionTask, TaskStatus
from app.models.truck import InspectionStatus, Truck
from app.models.user import AdminRole, User
from app.models.vehicle_inspection import VehicleInspection
from app.schemas.field_ops import InspectionOut, InspectionSubmit

router = APIRouter(prefix="/admin/inspections", tags=["inspections"])


@router.post("/{task_id}/submit", response_model=InspectionOut, status_code=201)
async def submit_inspection(
    task_id: uuid.UUID,
    payload: InspectionSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role(AdminRole.field_inspector, AdminRole.iot_technician)),
):
    task = (await db.execute(select(InspectionTask).where(InspectionTask.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    if task.assigned_to != current_user.id:
        raise HTTPException(403, "Not your assigned task")
    if task.status not in (TaskStatus.in_progress, TaskStatus.pending):
        raise HTTPException(400, f"Task is in status '{task.status}', cannot submit")

    inspection = VehicleInspection(
        task_id=task_id,
        inspector_id=current_user.id,
        truck_id=task.truck_id,
        submitted_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    db.add(inspection)

    task.status = TaskStatus.submitted

    truck = (await db.execute(select(Truck).where(Truck.id == task.truck_id))).scalar_one_or_none()
    if truck:
        truck.inspection_status = InspectionStatus.submitted
        if payload.tracker_status.value == "verified" and payload.tracker_id:
            truck.gps_tracker_id = payload.tracker_id

    await db.commit()
    await db.refresh(inspection)
    return inspection


@router.get("")
async def list_inspections(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role(
        AdminRole.compliance_officer, AdminRole.operations_admin, AdminRole.field_inspector,
    )),
):
    q = select(VehicleInspection)
    # Field inspectors see only their own submissions
    if current_user.admin_role == AdminRole.field_inspector:
        q = q.where(VehicleInspection.inspector_id == current_user.id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(VehicleInspection.created_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return {"total": total, "page": page, "limit": limit, "items": [InspectionOut.model_validate(r) for r in rows]}


@router.get("/{inspection_id}", response_model=InspectionOut)
async def get_inspection(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(
        AdminRole.compliance_officer, AdminRole.field_inspector, AdminRole.operations_admin,
    )),
):
    insp = (await db.execute(select(VehicleInspection).where(VehicleInspection.id == inspection_id))).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    return insp
