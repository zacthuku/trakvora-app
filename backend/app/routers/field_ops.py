import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin_role
from app.models.inspection_task import InspectionTask, TaskStatus
from app.models.truck import InspectionStatus, Truck
from app.models.user import AdminRole, User
from app.schemas.field_ops import TaskAssign, TaskCreate, TaskOut

router = APIRouter(prefix="/admin/field-ops", tags=["field-ops"])


@router.post("/tasks", response_model=TaskOut, status_code=201)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.operations_admin)),
):
    truck = (await db.execute(select(Truck).where(Truck.id == payload.truck_id))).scalar_one_or_none()
    if not truck:
        raise HTTPException(404, "Truck not found")

    task = InspectionTask(**payload.model_dump())
    db.add(task)
    truck.inspection_status = InspectionStatus.pending
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/tasks")
async def list_tasks(
    task_status: str | None = Query(None, alias="status"),
    assigned_to: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role(
        AdminRole.operations_admin, AdminRole.field_inspector, AdminRole.iot_technician,
    )),
):
    q = select(InspectionTask)
    if current_user.admin_role in (AdminRole.field_inspector, AdminRole.iot_technician):
        q = q.where(InspectionTask.assigned_to == current_user.id)
    elif assigned_to:
        q = q.where(InspectionTask.assigned_to == assigned_to)
    if task_status:
        q = q.where(InspectionTask.status == task_status)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(InspectionTask.created_at.desc())
         .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return {"total": total, "page": page, "limit": limit, "items": [TaskOut.model_validate(r) for r in rows]}


@router.patch("/tasks/{task_id}/assign", response_model=TaskOut)
async def assign_task(
    task_id: uuid.UUID,
    payload: TaskAssign,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.operations_admin)),
):
    task = (await db.execute(select(InspectionTask).where(InspectionTask.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    inspector = (await db.execute(select(User).where(User.id == payload.inspector_user_id))).scalar_one_or_none()
    if not inspector or inspector.admin_role not in (AdminRole.field_inspector, AdminRole.iot_technician):
        raise HTTPException(400, "Target user must be a field inspector or IoT technician")

    task.assigned_to = payload.inspector_user_id
    task.status = TaskStatus.in_progress
    task.assigned_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role(
        AdminRole.operations_admin, AdminRole.field_inspector, AdminRole.iot_technician,
    )),
):
    task = (await db.execute(select(InspectionTask).where(InspectionTask.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    if current_user.admin_role in (AdminRole.field_inspector, AdminRole.iot_technician):
        if task.assigned_to != current_user.id:
            raise HTTPException(403, "Not your task")
    return task


@router.get("/trucks/lookup")
async def lookup_truck(
    q: str = Query(..., min_length=2, description="Registration number or tracker ID"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(
        AdminRole.field_inspector, AdminRole.iot_technician, AdminRole.operations_admin,
    )),
):
    """Find a truck by registration number (partial) or GPS tracker ID, and return any open task."""
    truck = (await db.execute(
        select(Truck).where(
            func.lower(Truck.registration_number).contains(q.lower()) |
            (Truck.gps_tracker_id == q)
        )
    )).scalar_one_or_none()
    if not truck:
        raise HTTPException(404, "Truck not found")

    task = (await db.execute(
        select(InspectionTask).where(
            InspectionTask.truck_id == truck.id,
            InspectionTask.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        ).order_by(InspectionTask.created_at.desc())
    )).scalar_one_or_none()

    return {
        "truck_id": str(truck.id),
        "registration_number": truck.registration_number,
        "make": truck.make,
        "model": truck.model,
        "truck_type": truck.truck_type.value if truck.truck_type else None,
        "task_id": str(task.id) if task else None,
        "task_status": task.status.value if task else None,
    }
