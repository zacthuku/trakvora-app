import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, ShipmentNotFound
from app.models.load import Load, LoadStatus
from app.models.tracking_point import TrackingSource
from app.models.user import User, UserRole
from app.repositories.load_repo import LoadRepository
from app.repositories.shipment_repo import ShipmentRepository
from app.repositories.tracking_repo import TrackingRepository
from app.schemas.shipment import ConsignmentNoteOut, LocationUpdate, ShipmentOut, ShipmentStatusUpdate
from app.services import email_service, payment_service, sms_service

_VALID_TRANSITIONS = {
    LoadStatus.booked: [LoadStatus.en_route_pickup],
    LoadStatus.en_route_pickup: [LoadStatus.loaded],
    LoadStatus.loaded: [LoadStatus.in_transit],
    LoadStatus.in_transit: [LoadStatus.delivered],
}


async def get_active_shipment(current_user: User, db: AsyncSession) -> ShipmentOut | None:
    repo = ShipmentRepository(db)
    shipment = await repo.get_active_by_driver(current_user.id)
    if not shipment:
        return None
    return ShipmentOut.model_validate(shipment)


async def get_by_load_id(load_id: uuid.UUID, current_user: User, db: AsyncSession) -> ShipmentOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_load(load_id)
    if not shipment:
        raise ShipmentNotFound()
    load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
    load = load_result.scalar_one_or_none()
    _assert_access(shipment, current_user, load)
    return ShipmentOut.model_validate(shipment)


async def get_shipment(shipment_id: uuid.UUID, current_user: User, db: AsyncSession) -> ShipmentOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_id(shipment_id)
    if not shipment:
        raise ShipmentNotFound()
    load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
    load = load_result.scalar_one_or_none()
    _assert_access(shipment, current_user, load)
    return ShipmentOut.model_validate(shipment)


async def update_status(
    shipment_id: uuid.UUID,
    payload: ShipmentStatusUpdate,
    current_user: User,
    db: AsyncSession,
) -> ShipmentOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_id(shipment_id)
    if not shipment:
        raise ShipmentNotFound()
    _assert_access(shipment, current_user)

    allowed = _VALID_TRANSITIONS.get(shipment.status, [])
    if payload.status not in allowed:
        raise ForbiddenError(f"Cannot transition from {shipment.status} to {payload.status}")

    updates: dict = {"status": payload.status}
    if payload.status == LoadStatus.delivered:
        if not payload.delivery_photo_urls:
            raise ForbiddenError("A delivery photo is required to mark as delivered")
        if not payload.delivery_code or payload.delivery_code.upper() != (shipment.delivery_code or "").upper():
            raise ForbiddenError("Invalid delivery confirmation code")
        updates["delivered_at"] = datetime.now(timezone.utc)
    if payload.pickup_photo_urls:
        updates["pickup_photo_urls"] = payload.pickup_photo_urls
    if payload.delivery_photo_urls:
        updates["delivery_photo_urls"] = payload.delivery_photo_urls

    updated = await repo.update(shipment, **updates)

    # Keep load status in sync with shipment status
    load_repo = LoadRepository(db)
    load = await load_repo.get_by_id(shipment.load_id)
    if load:
        await load_repo.update(load, status=payload.status)

    if payload.status in (LoadStatus.in_transit, LoadStatus.delivered) and load:
        shipper_result = await db.execute(select(User).where(User.id == load.shipper_id))
        shipper = shipper_result.scalar_one_or_none()
        if shipper:
            route = f"{load.pickup_location} → {load.dropoff_location}"
            if payload.status == LoadStatus.in_transit:
                asyncio.create_task(
                    email_service.send_shipment_in_transit_email(shipper.email, shipper.full_name, route)
                )
            else:
                asyncio.create_task(
                    email_service.send_shipment_delivered_email(
                        shipper.email, shipper.full_name, route, float(load.price_kes)
                    )
                )
            if shipper.phone:
                asyncio.create_task(
                    sms_service.send_shipment_status_sms(shipper.phone, payload.status.value, route)
                )

    return ShipmentOut.model_validate(updated)


async def update_location(
    shipment_id: uuid.UUID,
    payload: LocationUpdate,
    current_user: User,
    db: AsyncSession,
) -> ShipmentOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_id(shipment_id)
    if not shipment:
        raise ShipmentNotFound()
    if shipment.driver_id != current_user.id:
        raise ForbiddenError("Only the assigned driver can update location")
    updates: dict = {"current_latitude": payload.latitude, "current_longitude": payload.longitude}
    if payload.eta:
        updates["eta"] = payload.eta
    updated = await repo.update(shipment, **updates)

    tracking_repo = TrackingRepository(db)
    await tracking_repo.create(
        truck_id=shipment.truck_id,
        shipment_id=shipment.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        source=TrackingSource.driver_phone,
        accuracy=payload.accuracy,
        speed_kmh=payload.speed_kmh,
        heading=payload.heading,
    )

    return ShipmentOut.model_validate(updated)


async def sign_consignment_note(
    shipment_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> ConsignmentNoteOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_id(shipment_id)
    if not shipment:
        raise ShipmentNotFound()
    note = await repo.get_consignment_note(shipment_id)
    if not note:
        raise ShipmentNotFound()

    updates: dict = {}
    if current_user.id == shipment.driver_id:
        updates["driver_accepted"] = True
    elif current_user.id == shipment.owner_id:
        updates["owner_accepted"] = True
    else:
        load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
        load = load_result.scalar_one_or_none()
        if load and load.shipper_id == current_user.id:
            updates["shipper_accepted"] = True
        else:
            raise ForbiddenError()

    updated_note = await repo.update_consignment_note(note, **updates)
    return ConsignmentNoteOut.model_validate(updated_note)


def _assert_access(shipment, current_user: User, load: Load | None = None) -> None:
    if current_user.role == UserRole.admin:
        return
    allowed_ids = {shipment.driver_id, shipment.owner_id}
    if load:
        allowed_ids.add(load.shipper_id)
    if current_user.id not in allowed_ids:
        raise ForbiddenError()


async def confirm_delivery(
    shipment_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> ShipmentOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_id(shipment_id)
    if not shipment:
        raise ShipmentNotFound()

    load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
    load = load_result.scalar_one_or_none()
    if not load or load.shipper_id != current_user.id:
        raise ForbiddenError("Only the shipper can confirm delivery")

    if shipment.status != LoadStatus.delivered:
        raise ForbiddenError("Shipment must be in delivered state")

    if shipment.escrow_released:
        return ShipmentOut.model_validate(shipment)

    await payment_service.release_escrow(
        shipment_id=shipment.id,
        shipper_user_id=load.shipper_id,
        owner_user_id=shipment.owner_id,
        amount_kes=float(load.price_kes),
        db=db,
    )
    updated = await repo.update(
        shipment,
        escrow_released=True,
        payment_confirmed_at=datetime.now(timezone.utc),
    )
    return ShipmentOut.model_validate(updated)
