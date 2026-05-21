import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models.move_request import MoveRequest
from app.models.user import User, UserRole

router = APIRouter(prefix="/move-requests", tags=["move-requests"])


class MoveRequestCreate(BaseModel):
    move_type: str = "home"
    origin_location: str
    origin_latitude: float
    origin_longitude: float
    origin_floor: int = 0
    origin_has_lift: bool = False
    destination_location: str
    destination_latitude: float
    destination_longitude: float
    destination_floor: int = 0
    destination_has_lift: bool = False
    move_date: str | None = None
    num_rooms: int | None = None
    estimated_volume_cbm: float | None = None
    requires_packing: bool = False
    requires_storage: bool = False
    inventory_items: list[dict[str, Any]] | None = None
    special_instructions: str | None = None
    price_kes: float = Field(..., gt=0)


class MoveRequestOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    shipper_id: uuid.UUID
    move_type: str
    origin_location: str
    destination_location: str
    move_date: str | None
    price_kes: float
    status: str
    created_at: datetime


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MoveRequestOut)
async def create_move_request(
    payload: MoveRequestCreate,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
) -> MoveRequestOut:
    move = MoveRequest(shipper_id=current_user.id, **payload.model_dump())
    db.add(move)
    await db.commit()
    await db.refresh(move)
    return move


@router.get("", response_model=list[MoveRequestOut])
async def list_move_requests(
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
) -> list[MoveRequestOut]:
    result = await db.execute(
        select(MoveRequest)
        .where(MoveRequest.shipper_id == current_user.id)
        .order_by(MoveRequest.created_at.desc())
    )
    return result.scalars().all()
