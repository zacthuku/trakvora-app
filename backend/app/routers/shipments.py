import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.shipment import ConfirmDeliveryIn, ConsignmentNoteOut, CustomerConfirmDeliveryIn, LocationUpdate, PublicShipmentSchema, ShipmentContactOut, ShipmentOut, ShipmentStatusUpdate
from app.services import email_service, shipment_service

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


@router.get("/my-fleet-active", response_model=list[ShipmentOut])
async def get_my_fleet_active_shipments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.shipment_repo import ShipmentRepository
    shipment_repo = ShipmentRepository(db)
    return await shipment_repo.get_active_by_owner(current_user.id)


@router.get("/by-load/{load_id}", response_model=ShipmentOut)
async def get_shipment_by_load(
    load_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.get_by_load_id(load_id, current_user, db)


@router.get("/{shipment_id}/contact", response_model=ShipmentContactOut)
async def get_shipment_contact(
    shipment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shipment_service.get_shipment_contact(shipment_id, current_user, db)


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
    body: ConfirmDeliveryIn = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shipper_pod_urls = body.shipper_pod_urls if body else None
    return await shipment_service.confirm_delivery(shipment_id, current_user, db, shipper_pod_urls=shipper_pod_urls)


@router.get("/public/{shipment_id}", response_model=PublicShipmentSchema)
async def get_public_shipment(
    shipment_id: uuid.UUID,
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.shipment_repo import ShipmentRepository
    shipment = await ShipmentRepository(db).get_by_id(shipment_id)
    if not shipment or shipment.share_token != share_token:
        raise HTTPException(status_code=404, detail="Invalid tracking link")
    return shipment


@router.post("/public/{shipment_id}/confirm-delivery")
async def customer_confirm_delivery(
    shipment_id: uuid.UUID,
    body: CustomerConfirmDeliveryIn,
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.shipment_repo import ShipmentRepository
    from app.models.user import User as UserModel
    shipment = await ShipmentRepository(db).get_by_id(shipment_id)
    if not shipment or shipment.share_token != body.share_token:
        raise HTTPException(status_code=404, detail="Invalid tracking link")
    if not shipment.delivery_code or shipment.delivery_code != body.delivery_code:
        raise HTTPException(status_code=400, detail="Invalid delivery code")
    if shipment.payment_confirmed_at:
        raise HTTPException(status_code=409, detail="Delivery already confirmed")
    # Retrieve the shipper to pass as current_user (confirm_delivery sends notifications)
    from sqlalchemy import select
    from app.repositories.load_repo import LoadRepository
    load = await LoadRepository(db).get_by_id(shipment.load_id)
    shipper = (await db.execute(select(UserModel).where(UserModel.id == load.shipper_id))).scalar_one_or_none() if load else None
    if not shipper:
        raise HTTPException(status_code=500, detail="Could not locate shipment owner")
    await shipment_service.confirm_delivery(shipment_id, shipper, db, shipper_pod_urls=None)
    return {"confirmed": True}


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

    from app.models.load import Load
    load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
    load = load_result.scalar_one_or_none()
    route = f"{load.pickup_location} → {load.dropoff_location}" if load else "your shipment"

    ratee_email: str | None = None
    ratee_name: str | None = None

    if is_shipper:
        if shipment.carrier_rating is not None:
            raise HTTPException(status_code=422, detail="You have already rated this shipment")
        shipment.carrier_rating = body.rating
        shipment.carrier_rating_comment = body.comment
        carrier_result = await db.execute(select(User).where(User.id == shipment.driver_id))
        carrier = carrier_result.scalar_one_or_none()
        if carrier:
            if carrier.total_trips > 0:
                carrier.rating = (carrier.rating * carrier.total_trips + body.rating) / (carrier.total_trips + 1)
            else:
                carrier.rating = float(body.rating)
            carrier.total_trips += 1
            ratee_email, ratee_name = carrier.email, carrier.full_name
    elif is_carrier:
        if shipment.shipper_rating is not None:
            raise HTTPException(status_code=422, detail="You have already rated this shipment")
        shipment.shipper_rating = body.rating
        shipment.shipper_rating_comment = body.comment
        shipper_id = load.shipper_id if load else None
        if shipper_id:
            shipper_result = await db.execute(select(User).where(User.id == shipper_id))
            shipper = shipper_result.scalar_one_or_none()
            if shipper:
                if shipper.total_trips > 0:
                    shipper.rating = (shipper.rating * shipper.total_trips + body.rating) / (shipper.total_trips + 1)
                else:
                    shipper.rating = float(body.rating)
                shipper.total_trips += 1
                ratee_email, ratee_name = shipper.email, shipper.full_name
    else:
        raise HTTPException(status_code=403, detail="Only shippers and carriers can rate shipments")

    await db.commit()

    if ratee_email and ratee_name:
        asyncio.create_task(
            email_service.send_rating_received_email(ratee_email, ratee_name, body.rating, route)
        )

    return {"ok": True}
