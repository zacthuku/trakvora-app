import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models.airfreight import Airfreight
from app.models.user import User, UserRole

router = APIRouter(prefix="/airfreight", tags=["airfreight"])


class AirfreightCreate(BaseModel):
    port_of_origin: str
    port_of_destination: str
    airline: str | None = None
    flight_number: str | None = None
    expected_departure: str | None = None
    hawb: str | None = None
    mawb: str | None = None
    cargo_description: str | None = None
    cargo_weight_kg: float = Field(..., gt=0)
    volume_cbm: float | None = None
    declared_value_usd: float | None = None
    is_dangerous_goods: bool = False
    iata_code: str | None = None
    special_instructions: str | None = None
    price_kes: float = Field(..., gt=0)


class AirfreightOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    shipper_id: uuid.UUID
    port_of_origin: str
    port_of_destination: str
    cargo_weight_kg: float
    price_kes: float
    status: str
    created_at: datetime


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AirfreightOut)
async def create_airfreight_booking(
    payload: AirfreightCreate,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
) -> AirfreightOut:
    booking = Airfreight(shipper_id=current_user.id, **payload.model_dump())
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.get("", response_model=list[AirfreightOut])
async def list_airfreight_bookings(
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
) -> list[AirfreightOut]:
    result = await db.execute(
        select(Airfreight)
        .where(Airfreight.shipper_id == current_user.id)
        .order_by(Airfreight.created_at.desc())
    )
    return result.scalars().all()
