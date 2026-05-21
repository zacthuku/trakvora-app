import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models.parcel import Parcel, ParcelServiceLevel
from app.models.user import User, UserRole

router = APIRouter(prefix="/parcels", tags=["parcels"])


class ParcelCreate(BaseModel):
    pickup_location: str
    pickup_latitude: float
    pickup_longitude: float
    dropoff_location: str
    dropoff_latitude: float
    dropoff_longitude: float
    weight_kg: float = Field(..., gt=0)
    length_cm: float | None = None
    width_cm: float | None = None
    height_cm: float | None = None
    contents_description: str | None = None
    declared_value_kes: float | None = None
    is_fragile: bool = False
    requires_insurance: bool = False
    service_level: ParcelServiceLevel = ParcelServiceLevel.standard
    recipient_name: str | None = None
    recipient_phone: str | None = None
    special_instructions: str | None = None
    price_kes: float = Field(..., gt=0)


class ParcelOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    shipper_id: uuid.UUID
    pickup_location: str
    dropoff_location: str
    weight_kg: float
    service_level: ParcelServiceLevel
    price_kes: float
    status: str
    created_at: datetime


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ParcelOut)
async def create_parcel(
    payload: ParcelCreate,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
) -> ParcelOut:
    parcel = Parcel(shipper_id=current_user.id, **payload.model_dump())
    db.add(parcel)
    await db.commit()
    await db.refresh(parcel)
    return parcel


@router.get("", response_model=list[ParcelOut])
async def list_parcels(
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
) -> list[ParcelOut]:
    result = await db.execute(
        select(Parcel)
        .where(Parcel.shipper_id == current_user.id)
        .order_by(Parcel.created_at.desc())
    )
    return result.scalars().all()
