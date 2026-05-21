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
from app.schemas.user import UserOut, UserPublicOut, UserUpdate
from app.services import kyc_service

router = APIRouter(tags=["users"])


class KYCSubmitRequest(BaseModel):
    id_type: str   # NATIONAL_ID | PASSPORT | DRIVERS_LICENSE | VOTER_ID
    id_number: str


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.delete("/me", status_code=204)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await UserRepository(db).delete(current_user)


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
    updated = await repo.update(
        current_user,
        kyc_status=new_status,
        national_id=payload.id_number,
        kyc_rejection_reason=rejection_reason,
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
