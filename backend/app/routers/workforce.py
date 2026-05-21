import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin_role
from app.models.user import AdminRole, User, UserRole
from app.schemas.field_ops import AssignAdminRole, PromoteUser

router = APIRouter(prefix="/admin/workforce", tags=["workforce"])


@router.get("")
async def list_workforce(
    admin_role: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.operations_admin)),
):
    q = select(User).where(User.role == UserRole.admin)
    if admin_role:
        q = q.where(User.admin_role == admin_role)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "admin_role": u.admin_role.value if u.admin_role else None,
                "is_active": u.is_active,
            }
            for u in rows
        ],
    }


@router.post("/assign-role")
async def assign_admin_role(
    payload: AssignAdminRole,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.operations_admin)),
):
    try:
        role_enum = AdminRole(payload.admin_role)
    except ValueError:
        raise HTTPException(400, f"Invalid admin_role: {payload.admin_role}")

    target = (await db.execute(select(User).where(User.id == payload.user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    if target.role != UserRole.admin:
        raise HTTPException(400, "User must have role=admin to be assigned an admin sub-role")

    target.admin_role = role_enum
    await db.commit()
    return {"user_id": str(target.id), "admin_role": role_enum.value}


@router.post("/promote")
async def promote_to_admin(
    payload: PromoteUser,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.operations_admin)),
):
    """Promote any user to admin and assign an admin sub-role in one step."""
    try:
        role_enum = AdminRole(payload.admin_role)
    except ValueError:
        raise HTTPException(400, f"Invalid admin_role: {payload.admin_role}")

    target = (await db.execute(select(User).where(User.id == payload.user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    target.role = UserRole.admin
    target.admin_role = role_enum
    await db.commit()
    return {
        "user_id": str(target.id),
        "full_name": target.full_name,
        "email": target.email,
        "role": "admin",
        "admin_role": role_enum.value,
    }
