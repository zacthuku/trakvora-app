import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.shipment import ConsignmentNoteOut, LocationUpdate, ShipmentOut, ShipmentStatusUpdate
from app.services import shipment_service

router = APIRouter(tags=["shipments"])


@router.get("/unrated", response_model=list[ShipmentOut])
async def get_unrated_shipments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Shipments the caller delivered but hasn't rated the shipper for yet (driver/owner view)."""
    from sqlalchemy import select
    from app.models.shipment import Shipment
    from app.models.load import LoadStatus

    q = (
        select(Shipment)
        .where(
            Shipment.status == LoadStatus.delivered,
            Shipment.shipper_rating == None,  # noqa: E711
            Shipment.driver_id == current_user.id,
        )
        .order_by(Shipment.delivered_at.desc().nullslast())
        .limit(20)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/my-active", response_model=Optional[ShipmentOut])
async def get_my_active_shipment(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.get_active_shipment(current_user, db)


@router.get("/by-load/{load_id}", response_model=ShipmentOut)
async def get_shipment_by_load(
    load_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.get_by_load_id(load_id, current_user, db)


@router.get("/{shipment_id}", response_model=ShipmentOut)
async def get_shipment(
    shipment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.get_shipment(shipment_id, current_user, db)


@router.patch("/{shipment_id}/status", response_model=ShipmentOut)
async def update_status(
    shipment_id: uuid.UUID,
    payload: ShipmentStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.update_status(shipment_id, payload, current_user, db)


@router.patch("/{shipment_id}/location", response_model=ShipmentOut)
async def update_location(
    shipment_id: uuid.UUID,
    payload: LocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.update_location(shipment_id, payload, current_user, db)


@router.post("/{shipment_id}/consignment/sign", response_model=ConsignmentNoteOut)
async def sign_consignment(
    shipment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.sign_consignment_note(shipment_id, current_user, db)


@router.post("/{shipment_id}/confirm-delivery", response_model=ShipmentOut)
async def confirm_delivery(
    shipment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.confirm_delivery(shipment_id, current_user, db)


class RatingIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


@router.post("/{shipment_id}/rate", status_code=status.HTTP_200_OK)
async def rate_shipment(
    shipment_id: uuid.UUID,
    body: RatingIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.shipment import Shipment
    from app.models.load import LoadStatus

    result = await db.execute(select(Shipment).where(Shipment.id == shipment_id))
    shipment = result.scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.status != LoadStatus.delivered:
        raise HTTPException(status_code=422, detail="Shipment must be delivered before rating")

    is_shipper = current_user.role == UserRole.shipper
    is_carrier = current_user.role in (UserRole.owner, UserRole.driver)

    if is_shipper:
        if shipment.carrier_rating is not None:
            raise HTTPException(status_code=422, detail="You have already rated this shipment")
        shipment.carrier_rating = body.rating
        shipment.carrier_rating_comment = body.comment
        # Update carrier's rolling average rating
        carrier_result = await db.execute(select(User).where(User.id == shipment.driver_id))
        carrier = carrier_result.scalar_one_or_none()
        if carrier:
            if carrier.total_trips > 0:
                carrier.rating = (carrier.rating * carrier.total_trips + body.rating) / (carrier.total_trips + 1)
            else:
                carrier.rating = float(body.rating)
            carrier.total_trips += 1
    elif is_carrier:
        if shipment.shipper_rating is not None:
            raise HTTPException(status_code=422, detail="You have already rated this shipment")
        shipment.shipper_rating = body.rating
        shipment.shipper_rating_comment = body.comment
        # Update shipper's rolling average rating (no trip increment for carrier rating)
        from app.models.load import Load
        load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
        load = load_result.scalar_one_or_none()
        shipper_id = load.shipper_id if load else None
        if shipper_id:
            shipper_result = await db.execute(select(User).where(User.id == shipper_id))
            shipper = shipper_result.scalar_one_or_none()
            if shipper:
                trips = max(shipper.total_trips, 1)
                shipper.rating = (shipper.rating * (trips - 1) + body.rating) / trips
    else:
        raise HTTPException(status_code=403, detail="Only shippers and carriers can rate shipments")

    await db.commit()
    return {"ok": True}
