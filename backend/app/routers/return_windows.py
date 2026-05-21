import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models.load import Load, LoadStatus
from app.models.return_window import ReturnWindow
from app.models.user import User, UserRole

router = APIRouter(prefix="/return-windows", tags=["return-windows"])


class ReturnWindowCreate(BaseModel):
    truck_id: uuid.UUID
    origin_location: str
    origin_latitude: float
    origin_longitude: float
    destination_location: str
    destination_latitude: float
    destination_longitude: float
    available_from: str
    available_until: str | None = None
    capacity_tonnes: float = Field(..., gt=0)
    notes: str | None = None


class ReturnWindowOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    driver_id: uuid.UUID
    truck_id: uuid.UUID
    origin_location: str
    destination_location: str
    available_from: str
    available_until: str | None
    capacity_tonnes: float
    notes: str | None
    is_active: bool
    created_at: datetime


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ReturnWindowOut)
async def create_return_window(
    payload: ReturnWindowCreate,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
) -> ReturnWindowOut:
    window = ReturnWindow(driver_id=current_user.id, **payload.model_dump())
    db.add(window)
    await db.commit()
    await db.refresh(window)
    return window


@router.get("", response_model=list[ReturnWindowOut])
async def list_return_windows(
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
) -> list[ReturnWindowOut]:
    result = await db.execute(
        select(ReturnWindow)
        .where(ReturnWindow.driver_id == current_user.id)
        .order_by(ReturnWindow.created_at.desc())
    )
    return result.scalars().all()


@router.get("/matches")
async def get_return_window_matches(
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    windows_result = await db.execute(
        select(ReturnWindow).where(
            ReturnWindow.driver_id == current_user.id,
            ReturnWindow.is_active == True,
        )
    )
    windows = windows_result.scalars().all()

    output = []
    for w in windows:
        lat = w.origin_latitude
        lng = w.origin_longitude
        haversine_km = (
            6371
            * func.acos(
                func.cos(func.radians(lat))
                * func.cos(func.radians(Load.pickup_latitude))
                * func.cos(func.radians(Load.pickup_longitude) - func.radians(lng))
                + func.sin(func.radians(lat))
                * func.sin(func.radians(Load.pickup_latitude))
            )
        )
        matches_result = await db.execute(
            select(Load)
            .where(
                Load.status == LoadStatus.available,
                Load.weight_tonnes <= w.capacity_tonnes,
                haversine_km <= 100,
            )
            .order_by(haversine_km)
            .limit(5)
        )
        matches = matches_result.scalars().all()
        output.append({
            "window_id": str(w.id),
            "origin_location": w.origin_location,
            "destination_location": w.destination_location,
            "matches": [
                {
                    "id": str(m.id),
                    "pickup_location": m.pickup_location,
                    "dropoff_location": m.dropoff_location,
                    "cargo_type": m.cargo_type,
                    "weight_tonnes": m.weight_tonnes,
                    "price_kes": float(m.price_kes),
                    "pickup_date": m.pickup_date,
                }
                for m in matches
            ],
        })
    return output


@router.delete("/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_return_window(
    window_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ReturnWindow).where(
            ReturnWindow.id == window_id,
            ReturnWindow.driver_id == current_user.id,
        )
    )
    window = result.scalar_one_or_none()
    if not window:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return window not found")
    await db.delete(window)
    await db.commit()
