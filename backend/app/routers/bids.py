import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InsufficientFunds
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.bid import BidCreate, BidOut, BidWithLoadOut
from app.services import bid_service

router = APIRouter(tags=["bids"])


def _can_bid(user: User) -> bool:
    return user.role in (UserRole.owner, UserRole.driver) or (
        user.role == UserRole.shipper and user.can_carry
    )


def _assert_verified(user: User) -> None:
    if not user.is_verified or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending verification. You cannot transact until approved.",
        )


@router.post("", response_model=BidOut, status_code=201)
async def place_bid(
    payload: BidCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _can_bid(current_user):
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError()
    _assert_verified(current_user)
    return await bid_service.place_bid(payload, current_user, db)


@router.get("/my-bids", response_model=list[BidWithLoadOut])
async def list_my_bids(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _can_bid(current_user):
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError()
    return await bid_service.list_my_bids(current_user, db)


@router.get("/load/{load_id}", response_model=list[BidOut])
async def list_bids(
    load_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await bid_service.list_bids_for_load(load_id, current_user, db)


@router.patch("/{bid_id}/withdraw", response_model=BidOut)
async def withdraw_bid(
    bid_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await bid_service.withdraw_bid(bid_id, current_user, db)


@router.patch("/{bid_id}/accept", response_model=BidOut)
async def accept_bid(
    bid_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await bid_service.accept_bid(bid_id, current_user, db)
    except InsufficientFunds as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "insufficient_funds",
                "message": "Insufficient wallet balance to lock escrow for this shipment.",
                "shortfall_kes": e.shortfall,
            },
        )
