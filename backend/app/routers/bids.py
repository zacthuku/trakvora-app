import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.bid import BidCreate, BidOut, BidWithLoadOut
from app.services import bid_service

router = APIRouter(tags=["bids"])


@router.post("", response_model=BidOut, status_code=201)
async def place_bid(
    payload: BidCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.owner, UserRole.driver):
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError()
    return await bid_service.place_bid(payload, current_user, db)


@router.get("/my-bids", response_model=list[BidWithLoadOut])
async def list_my_bids(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.owner, UserRole.driver):
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
    return await bid_service.accept_bid(bid_id, current_user, db)
