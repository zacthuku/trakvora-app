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
from app.schemas.shipment import ConsignmentNoteOut, LocationUpdate, ShipmentContactOut, ShipmentOut, ShipmentStatusUpdate
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


async def get_shipment_contact(
    shipment_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> ShipmentContactOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_id(shipment_id)
    if not shipment:
        raise ShipmentNotFound()
    load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
    load = load_result.scalar_one_or_none()
    _assert_access(shipment, current_user, load)

    user_ids = {uid for uid in (load.shipper_id if load else None, shipment.owner_id, shipment.driver_id) if uid}
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = {u.id: u for u in users_result.scalars().all()}

    shipper = users.get(load.shipper_id) if load else None
    carrier = users.get(shipment.owner_id)
    driver = users.get(shipment.driver_id) if shipment.driver_id != shipment.owner_id else None

    return ShipmentContactOut(
        shipper_name=shipper.full_name if shipper else None,
        shipper_company=shipper.company_name if shipper else None,
        shipper_phone=shipper.phone if shipper else None,
        carrier_name=carrier.full_name if carrier else None,
        carrier_company=carrier.company_name if carrier else None,
        carrier_phone=carrier.phone if carrier else None,
        driver_name=driver.full_name if driver else None,
        driver_phone=driver.phone if driver else None,
    )


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
        load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
        load_for_delivery = load_result.scalar_one_or_none()

        if load_for_delivery and load_for_delivery.unattended_delivery:
            # Unattended: GPS proximity replaces delivery code
            from app.services.geofence_service import is_at_location
            dlat = payload.delivery_latitude
            dlng = payload.delivery_longitude
            if (
                dlat is None or dlng is None
                or not is_at_location(
                    dlat, dlng,
                    load_for_delivery.dropoff_latitude,
                    load_for_delivery.dropoff_longitude,
                )
            ):
                raise ForbiddenError(
                    "Must be within 150 m of the delivery point. "
                    "Ensure GPS is enabled and you are at the dropoff location."
                )
            updates["delivery_method"] = "unattended_gps"
            # Photo not required for unattended deliveries — GPS stamp is the proof
            # Reverse-geocode the delivery location (non-blocking)
            from app.services import geocoding_service
            place_name = await geocoding_service.reverse_geocode(dlat, dlng)
            if place_name:
                updates["delivery_location_name"] = place_name
        else:
            # Attended: require delivery code and photo
            if not payload.delivery_photo_urls and not payload.no_photo_reason:
                raise ForbiddenError("A delivery photo is required, or set no_photo_reason (e.g. 'no_smartphone')")
            if not payload.delivery_code or payload.delivery_code.upper() != (shipment.delivery_code or "").upper():
                raise ForbiddenError("Invalid delivery confirmation code")
            updates["delivery_method"] = "attended"

        updates["delivered_at"] = datetime.now(timezone.utc)
        # POD enrichment fields (optional but recommended)
        if payload.pod_signature_url:
            updates["pod_signature_url"] = payload.pod_signature_url
        if payload.delivery_latitude is not None:
            updates["delivery_latitude"] = payload.delivery_latitude
        if payload.delivery_longitude is not None:
            updates["delivery_longitude"] = payload.delivery_longitude
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
                # Prompt shipper to rate their carrier
                asyncio.create_task(
                    email_service.send_rating_prompt_email(shipper.email, shipper.full_name, "shipper", route)
                )
                # Prompt driver/carrier to rate the shipper
                if shipment.driver_id:
                    driver_result = await db.execute(select(User).where(User.id == shipment.driver_id))
                    driver = driver_result.scalar_one_or_none()
                    if driver:
                        asyncio.create_task(
                            email_service.send_rating_prompt_email(driver.email, driver.full_name, "carrier", route)
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
    else:
        # Auto-compute ETA if we have a destination
        load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
        _load = load_result.scalar_one_or_none()
        if _load and _load.dropoff_latitude and _load.dropoff_longitude:
            try:
                from app.services.eta_service import compute_eta
                updates["eta"] = await compute_eta(
                    payload.latitude, payload.longitude,
                    _load.dropoff_latitude, _load.dropoff_longitude,
                    speed_kmh=payload.speed_kmh,
                )
            except Exception:  # noqa: BLE001
                pass
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
    *,
    shipper_pod_urls: str | None = None,
) -> ShipmentOut:
    repo = ShipmentRepository(db)
    shipment = await repo.get_by_id(shipment_id)
    if not shipment:
        raise ShipmentNotFound()

    load_result = await db.execute(select(Load).where(Load.id == shipment.load_id))
    load = load_result.scalar_one_or_none()
    if not load or load.shipper_id != current_user.id:
        raise ForbiddenError("Only the shipper can confirm delivery")

    # Tier 3: shipper confirms with their own photos when driver had no phone
    if shipment.status == LoadStatus.in_transit:
        if not shipper_pod_urls:
            raise ForbiddenError("Provide shipper_pod_urls to confirm delivery when driver has not yet marked delivered")
        load_repo = LoadRepository(db)
        await repo.update(
            shipment,
            status=LoadStatus.delivered,
            delivered_at=datetime.now(timezone.utc),
            delivery_photo_urls=shipper_pod_urls,
        )
        if load:
            await load_repo.update(load, status=LoadStatus.delivered)
        await db.refresh(shipment)

    elif shipment.status != LoadStatus.delivered:
        raise ForbiddenError("Shipment must be in delivered or in_transit state")

    now = datetime.now(timezone.utc)
    mode = getattr(shipment, "payment_mode", "direct") or "direct"

    if mode == "escrow":
        # Escrow mode: funds were pre-held; release to owner and create commission invoice
        if shipment.escrow_released:
            return ShipmentOut.model_validate(shipment)
        await payment_service.release_escrow(
            shipment_id     = shipment.id,
            shipper_user_id = load.shipper_id,
            owner_user_id   = shipment.owner_id,
            amount_kes      = float(load.price_kes),
            db              = db,
            delivered_at    = shipment.delivered_at or now,
        )
        updated = await repo.update(
            shipment,
            escrow_released=True,
            payment_confirmed_at=now,
        )
    else:
        # Direct mode: shipper paid carrier directly (cash/mobile/bank outside Trakvora).
        # Just create the commission invoice for the carrier.
        if shipment.payment_confirmed_at:
            return ShipmentOut.model_validate(shipment)
        await payment_service.confirm_direct_payment(
            shipment_id     = shipment.id,
            shipper_user_id = load.shipper_id,
            owner_user_id   = shipment.owner_id,
            amount_kes      = float(load.price_kes),
            db              = db,
        )
        updated = await repo.update(
            shipment,
            direct_payment_confirmed_at = now,
            payment_confirmed_at        = now,
        )

    return ShipmentOut.model_validate(updated)
