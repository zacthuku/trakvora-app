import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import KycStatus, User, UserRole
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserOut, UserPublicOut, UserUpdate, RoleChangeRequest
from app.services import kyc_service

router = APIRouter(tags=["users"])


class KYCSubmitRequest(BaseModel):
    id_type: str   # NATIONAL_ID | PASSPORT | DRIVERS_LICENSE | VOTER_ID
    id_number: str
    selfie_url: str | None = None


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.delete("/me", status_code=204)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.activity_service import log_activity
    repo = UserRepository(db)
    await repo.soft_delete(current_user, reason="user_requested")
    await log_activity(
        db,
        action="user_self_deleted",
        resource_type="user",
        resource_id=current_user.id,
        summary=f"User {current_user.full_name} ({current_user.email}) deleted their own account",
    )
    await db.commit()


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    updated = await repo.update(current_user, **payload.model_dump(exclude_none=True))
    return updated


@router.post("/me/kyc", response_model=UserOut)
async def submit_kyc(
    payload: KYCSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit national ID for identity verification."""
    if current_user.kyc_status == KycStatus.approved:
        raise HTTPException(status_code=400, detail="Identity already verified")
    new_status, rejection_reason = await kyc_service.submit_kyc(
        current_user, payload.id_type, payload.id_number
    )
    repo = UserRepository(db)
    extra = {"kyc_selfie_url": payload.selfie_url} if payload.selfie_url else {}
    updated = await repo.update(
        current_user,
        kyc_status=new_status,
        national_id=payload.id_number,
        kyc_rejection_reason=rejection_reason,
        **extra,
    )
    return updated


@router.post("/me/upgrade-to-owner", response_model=UserOut)
async def upgrade_to_owner(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upgrade a driver account to fleet owner when they register a second truck."""
    if current_user.role != UserRole.driver:
        raise HTTPException(status_code=400, detail="Only driver accounts can be upgraded to fleet owner.")
    repo = UserRepository(db)
    updated = await repo.update(current_user, role=UserRole.owner)
    return updated


@router.get("/owners/search", response_model=list[UserPublicOut])
async def search_fleet_owners(
    q: str | None = Query(None, description="Search by name"),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search fleet owners that shippers can send direct load offers to."""
    result = await db.execute(
        select(User).where(User.role == UserRole.owner)
    )
    owners = result.scalars().all()
    if q:
        q_lower = q.lower()
        owners = [o for o in owners if q_lower in (o.full_name or "").lower()]
    return owners


@router.get("/search-carriers")
async def search_carriers(
    q: str | None = Query(None, description="Search by name or phone"),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search fleet owners and drivers by name or phone — used for preferred network management."""
    from sqlalchemy import or_
    stmt = select(User).where(
        User.role.in_([UserRole.owner, UserRole.driver]),
        User.is_active == True,
    )
    if q:
        q_like = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(q_like),
                User.phone.ilike(q_like),
            )
        )
    stmt = stmt.limit(20)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "phone": u.phone,
            "role": u.role.value,
            "partner_tier": u.partner_tier.value if u.partner_tier else "standard",
            "is_verified": u.is_verified,
        }
        for u in users
    ]


@router.get("/{user_id}/public", response_model=UserPublicOut)
async def get_user_public(
    user_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Public profile of any user — safe fields only, no email/phone."""
    user = await UserRepository(db).get_by_id(user_id)
    if not user:
        raise NotFoundError("User")
    return user


_NOTIF_DEFAULTS: dict = {
    "bid_received":    {"in_app": True,  "push": True,  "sms": False, "email": False},
    "shipment_status": {"in_app": True,  "push": True,  "sms": True,  "email": False},
    "payment_due":     {"in_app": True,  "push": True,  "sms": True,  "email": True},
    "direct_offer":    {"in_app": True,  "push": True,  "sms": True,  "email": False},
    "dispute":         {"in_app": True,  "push": True,  "sms": True,  "email": True},
    "marketing":       {"in_app": False, "push": False, "sms": False, "email": False},
}


@router.get("/me/notification-preferences")
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
) -> dict:
    prefs = current_user.notification_preferences or {}
    merged = {k: {**v, **prefs.get(k, {})} for k, v in _NOTIF_DEFAULTS.items()}
    return merged


@router.patch("/me/notification-preferences")
async def update_notification_preferences(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    existing = current_user.notification_preferences or {}
    merged = {**existing}
    for key, channels in payload.items():
        if key in _NOTIF_DEFAULTS and isinstance(channels, dict):
            merged[key] = {**(merged.get(key) or {}), **channels}
    await UserRepository(db).update(current_user, notification_preferences=merged)
    await db.commit()
    result = {k: {**v, **merged.get(k, {})} for k, v in _NOTIF_DEFAULTS.items()}
    return result


@router.patch("/me/role", response_model=UserOut)
async def change_role(
    payload: RoleChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.auth_service import change_role as _change_role
    updated = await _change_role(current_user, payload.role, db)
    await db.commit()
    await db.refresh(updated)
    return updated


@router.patch("/me/fcm-token", status_code=204)
async def update_fcm_token(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register or update the FCM device token for the current user.
    Accepts: {"fcm_token": "..."}
    """
    token = payload.get("fcm_token", "").strip()
    if not token:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="fcm_token is required")
    await UserRepository(db).update(current_user, fcm_token=token)
    await db.commit()
