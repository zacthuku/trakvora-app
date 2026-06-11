import asyncio
import secrets
import string
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ActiveJobConflict, BidFloorViolation, BidNotFound, ConflictError, ForbiddenError, InsufficientFunds, LoadNotAvailable, LoadNotFound
from app.models.bid import BidStatus
from app.models.driver import Driver, VerificationStatus
from app.models.load import BookingMode, CargoType, Load, LoadStatus
from app.models.notification import NotificationType
from app.models.truck import TruckType
from app.models.user import User, UserRole
from app.repositories.bid_repo import BidRepository
from app.repositories.load_repo import LoadRepository
from app.repositories.message_repo import MessageRepository
from app.repositories.shipment_repo import ShipmentRepository
from app.repositories.truck_repo import TruckRepository
from app.schemas.bid import BidCreate, BidOut, BidWithLoadOut
from app.services import email_service, notification_service, payment_service, sms_service
from app.services.matching_service import CarrierCandidate, ScoredCandidate, rank_carriers

_CARGO_TRUCK_REQUIRED: dict[CargoType, TruckType] = {
    CargoType.refrigerated: TruckType.reefer,
    CargoType.hazardous:    TruckType.tanker,
}


def _check_timeline_conflict(active_load, new_load) -> None:
    if not active_load or not new_load.pickup_date or not active_load.pickup_date:
        raise ActiveJobConflict(
            "You have an active job in progress. Complete it before bidding on a new load."
        )
    try:
        new_start    = date.fromisoformat(new_load.pickup_date)
        active_start = date.fromisoformat(active_load.pickup_date)
        active_end   = (
            date.fromisoformat(active_load.delivery_date) if active_load.delivery_date
            else date.fromisoformat(active_load.pickup_deadline[:10]) if active_load.pickup_deadline
            else None
        )
    except (ValueError, TypeError):
        raise ActiveJobConflict(
            "You have an active job in progress. Complete it before bidding on a new load."
        )
    if active_end is None:
        raise ActiveJobConflict(
            "You have an active job with no confirmed end date. Complete it before bidding."
        )
    if active_start <= new_start <= active_end:
        raise ActiveJobConflict(
            f"You have an active job until {active_end:%d %b %Y}. "
            "You can only start new jobs from that date onwards."
        )


async def place_bid(payload: BidCreate, current_user: User, db: AsyncSession) -> BidOut:
    load_repo = LoadRepository(db)
    bid_repo = BidRepository(db)
    truck_repo = TruckRepository(db)

    load = await load_repo.get_by_id(payload.load_id)
    if not load:
        raise LoadNotFound()
    if load.status not in (LoadStatus.available, LoadStatus.bidding):
        raise LoadNotAvailable()
    if load.booking_mode == BookingMode.fixed:
        raise ConflictError("Fixed-price loads cannot be bid on. Use Accept Now instead.")
    if load.booking_mode == BookingMode.auction and load.min_bid_floor_kes:
        if payload.amount_kes < float(load.min_bid_floor_kes):
            raise BidFloorViolation(float(load.min_bid_floor_kes))

    truck = await truck_repo.get_by_id(payload.truck_id)
    if not truck:
        raise ForbiddenError("Truck does not belong to you")
    if truck.owner_id != current_user.id:
        from app.repositories.driver_repo import DriverRepository
        driver_repo = DriverRepository(db)
        driver = await driver_repo.get_by_user_id(current_user.id)
        if not driver or driver.current_truck_id != truck.id:
            raise ForbiddenError("Truck does not belong to you")

    # ── Verification gates ────────────────────────────────────────────────────
    if not truck.is_verified:
        raise ForbiddenError(
            "This truck has not been verified. "
            "Submit compliance documents and await admin approval before bidding."
        )
    if current_user.role == UserRole.driver:
        from app.repositories.driver_repo import DriverRepository as _DR
        _driver_repo = _DR(db)
        _driver = await _driver_repo.get_by_user_id(current_user.id)
        if not _driver or _driver.verification_status != VerificationStatus.approved:
            raise ForbiddenError(
                "Your driver profile must be verified before you can bid on loads. "
                "Upload your documents and submit for review."
            )
    # ── Capacity gate ─────────────────────────────────────────────────────────
    if truck.capacity_tonnes < load.weight_tonnes:
        raise ForbiddenError(
            f"Truck capacity ({truck.capacity_tonnes}t) is below load weight ({load.weight_tonnes}t). "
            "Use a truck with sufficient capacity."
        )

    # ── Cargo type ↔ truck type ────────────────────────────────────────────────
    required_type = _CARGO_TRUCK_REQUIRED.get(load.cargo_type)
    if required_type and truck.truck_type != required_type:
        raise ForbiddenError(
            f"This load requires a {required_type.value} truck. "
            f"Your {truck.truck_type.value} truck is not suitable for this cargo."
        )
    if load.required_truck_type and truck.truck_type.value != load.required_truck_type:
        raise ForbiddenError(
            f"This load requires a {load.required_truck_type} truck. "
            f"Your {truck.truck_type.value} truck does not qualify."
        )

    # ── Insurance gate ─────────────────────────────────────────────────────────
    if load.requires_insurance:
        if not truck.insurance_url:
            raise ForbiddenError(
                "This load requires cargo insurance. Upload your insurance document first."
            )
        if truck.insurance_expiry and truck.insurance_expiry < date.today():
            raise ForbiddenError(
                f"Your truck insurance expired on {truck.insurance_expiry:%d %b %Y}. Renew before bidding."
            )

    # ── NTSA inspection expiry ─────────────────────────────────────────────────
    if truck.ntsa_inspection_expiry and truck.ntsa_inspection_expiry < date.today():
        raise ForbiddenError(
            f"Your NTSA inspection expired on {truck.ntsa_inspection_expiry:%d %b %Y}. Renew before bidding."
        )

    # ── Active job conflict ────────────────────────────────────────────────────
    shipment_repo_check = ShipmentRepository(db)
    if current_user.role == UserRole.driver:
        active_shipment = await shipment_repo_check.get_active_by_driver(current_user.id)
        if active_shipment:
            active_load = (await db.execute(select(Load).where(Load.id == active_shipment.load_id))).scalar_one_or_none()
            _check_timeline_conflict(active_load, load)
    else:
        truck_shipment = await shipment_repo_check.get_active_by_truck(truck.id)
        if truck_shipment:
            truck_active_load = (await db.execute(select(Load).where(Load.id == truck_shipment.load_id))).scalar_one_or_none()
            if truck_active_load:
                _check_timeline_conflict(truck_active_load, load)
            else:
                raise ActiveJobConflict(
                    "This truck is already assigned to an active job. "
                    "Choose a different truck or wait until the current job is complete."
                )
    # ─────────────────────────────────────────────────────────────────────────

    existing = await bid_repo.existing_bid(payload.load_id, current_user.id)
    if existing:
        updated = await bid_repo.update(existing, amount_kes=payload.amount_kes, message=payload.message)
        return BidOut.model_validate(updated)

    if load.booking_mode == BookingMode.auction and load.status == LoadStatus.available:
        await load_repo.update(load, status=LoadStatus.bidding)

    bid = await bid_repo.create(
        load_id=payload.load_id,
        owner_id=current_user.id,
        truck_id=payload.truck_id,
        amount_kes=payload.amount_kes,
        message=payload.message,
    )

    route = f"{load.pickup_location} → {load.dropoff_location}"

    await notification_service.send_notification(
        user_id=load.shipper_id,
        notification_type=NotificationType.bid_received,
        title="New Bid Received",
        body=f"{current_user.full_name} placed a bid of KES {payload.amount_kes:,.0f} on your load: {route}.",
        reference_id=bid.id,
        reference_type="bid",
        db=db,
    )
    await MessageRepository(db).create(
        sender_id=current_user.id,
        recipient_id=load.shipper_id,
        subject="New bid on your load",
        body=(
            f"{current_user.full_name} has placed a bid of KES {payload.amount_kes:,.0f} on your load from {route}. "
            "Log in to review and compare bids."
        ),
    )
    shipper = (await db.execute(select(User).where(User.id == load.shipper_id))).scalar_one_or_none()
    if shipper:
        await email_service.send_bid_received_email(
            shipper.email, shipper.full_name, current_user.full_name, route, payload.amount_kes
        )
        if shipper.phone:
            asyncio.create_task(
                sms_service.send_bid_received_sms(shipper.phone, current_user.full_name, route)
            )

    return BidOut.model_validate(bid)


async def accept_bid(bid_id: uuid.UUID, current_user: User, db: AsyncSession) -> BidOut:
    bid_repo = BidRepository(db)
    load_repo = LoadRepository(db)
    shipment_repo = ShipmentRepository(db)

    bid = await bid_repo.get_by_id(bid_id)
    if not bid:
        raise BidNotFound()

    load = await load_repo.get_by_id(bid.load_id)
    if not load:
        raise LoadNotFound()
    if load.shipper_id != current_user.id:
        raise ForbiddenError("Only the shipper can accept bids")
    if load.status not in (LoadStatus.available, LoadStatus.bidding):
        raise LoadNotAvailable()

    # Capture other pending bids before reject_all_others clears their status
    other_pending = [
        b for b in await bid_repo.list_by_load(bid.load_id)
        if b.id != bid_id and b.status == BidStatus.pending
    ]

    accepted_price = float(bid.amount_kes)

    # ── Determine payment mode ────────────────────────────────────────────────
    use_escrow = getattr(load, "payment_mode", None)
    use_escrow = (use_escrow.value if hasattr(use_escrow, "value") else str(use_escrow or "direct")) == "escrow"

    # ── Pre-flight wallet check — for escrow mode only ────────────────────────
    from app.repositories.wallet_repo import WalletRepository
    wallet_repo = WalletRepository(db)
    if use_escrow:
        wallet = await wallet_repo.get_by_user(load.shipper_id)
        available = float(wallet.balance_kes) if wallet else 0.0
        if available < accepted_price:
            raise InsufficientFunds(shortfall=round(accepted_price - available, 2))
    # ─────────────────────────────────────────────────────────────────────────

    await bid_repo.update(bid, status=BidStatus.accepted)
    await bid_repo.reject_all_others(bid.load_id, bid.id)
    await load_repo.update(load, status=LoadStatus.booked, price_kes=accepted_price)

    driver_result = await db.execute(
        select(Driver).where(Driver.current_truck_id == bid.truck_id)
    )
    driver = driver_result.scalar_one_or_none()

    if not driver:
        # Fallback: look up the driver via the truck's assigned_driver_id field
        from app.models.truck import Truck
        truck_row = await db.execute(select(Truck).where(Truck.id == bid.truck_id))
        truck = truck_row.scalar_one_or_none()
        if truck and truck.assigned_driver_id:
            dr2 = await db.execute(select(Driver).where(Driver.id == truck.assigned_driver_id))
            driver = dr2.scalar_one_or_none()

    # Use resolved driver's user_id, or None — never fall back to the truck owner
    driver_id = driver.user_id if driver else None

    load_payment_mode = "escrow" if use_escrow else "direct"
    delivery_code = (
        None if load.unattended_delivery
        else "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    )
    shipment = await shipment_repo.create(
        load_id=bid.load_id,
        truck_id=bid.truck_id,
        driver_id=driver_id,
        owner_id=bid.owner_id,
        delivery_code=delivery_code,
        payment_mode=load_payment_mode,
    )

    if use_escrow:
        await payment_service.lock_escrow(
            shipment_id=shipment.id,
            shipper_user_id=load.shipper_id,
            amount_kes=accepted_price,
            db=db,
        )
        await shipment_repo.update(shipment, escrow_locked=True)

    route = f"{load.pickup_location} → {load.dropoff_location}"

    # Notify & message the winning owner
    await notification_service.send_notification(
        user_id=bid.owner_id,
        notification_type=NotificationType.bid_accepted,
        title="Bid Accepted!",
        body=f"Your bid of KES {bid.amount_kes:,.0f} for the load from {route} has been accepted.",
        reference_id=bid.id,
        reference_type="bid",
        db=db,
    )
    await MessageRepository(db).create(
        sender_id=current_user.id,
        recipient_id=bid.owner_id,
        subject="Your bid was accepted",
        body=(
            f"Congratulations! Your bid of KES {bid.amount_kes:,.0f} for {route} has been accepted. "
            "A shipment has been created and funds placed in escrow."
        ),
    )
    # Notify the shipper (with delivery code if attended, or GPS note if unattended)
    await MessageRepository(db).create(
        sender_id=current_user.id,
        recipient_id=load.shipper_id,
        subject="Shipment confirmed" + ("" if load.unattended_delivery else " — delivery code inside"),
        body=(
            f"Your shipment for {route} has been confirmed with carrier KES {bid.amount_kes:,.0f}. "
            + (
                "This is an unattended delivery — GPS proximity at the dropoff point will confirm delivery automatically."
                if load.unattended_delivery
                else f"Delivery confirmation code: {delivery_code[:3]}-{delivery_code[3:]} — share this code with the carrier when they arrive for delivery."
            )
        ),
    )
    winner = (await db.execute(select(User).where(User.id == bid.owner_id))).scalar_one_or_none()
    if winner:
        await email_service.send_bid_accepted_email(winner.email, winner.full_name, route, float(bid.amount_kes))

    # Notify & message each rejected owner
    for other in other_pending:
        await notification_service.send_notification(
            user_id=other.owner_id,
            notification_type=NotificationType.bid_rejected,
            title="Bid Not Selected",
            body=f"Your bid for the load from {route} was not selected.",
            reference_id=other.id,
            reference_type="bid",
            db=db,
        )
        await MessageRepository(db).create(
            sender_id=current_user.id,
            recipient_id=other.owner_id,
            subject="Bid not selected",
            body=(
                f"Thank you for your bid on the load from {route}. "
                "Another carrier was selected for this shipment."
            ),
        )
        rejected_owner = (await db.execute(select(User).where(User.id == other.owner_id))).scalar_one_or_none()
        if rejected_owner:
            await email_service.send_bid_rejected_email(rejected_owner.email, rejected_owner.full_name, route)

    return BidOut.model_validate(bid)


async def list_bids_for_load(load_id: uuid.UUID, current_user: User, db: AsyncSession) -> list[BidOut]:
    load_repo = LoadRepository(db)
    bid_repo = BidRepository(db)
    load = await load_repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()
    if load.shipper_id != current_user.id and current_user.role != UserRole.admin:
        raise ForbiddenError()
    bids = await bid_repo.list_by_load(load_id)
    return [BidOut.model_validate(b) for b in bids]


async def withdraw_bid(bid_id: uuid.UUID, current_user: User, db: AsyncSession) -> BidOut:
    bid_repo = BidRepository(db)
    bid = await bid_repo.get_by_id(bid_id)
    if not bid:
        raise BidNotFound()
    if bid.owner_id != current_user.id:
        raise ForbiddenError("This bid does not belong to you")
    if bid.status != BidStatus.pending:
        raise ForbiddenError("Only pending bids can be withdrawn")
    updated = await bid_repo.update(bid, status=BidStatus.withdrawn)
    return BidOut.model_validate(updated)


async def get_suggested_carriers(load_id: uuid.UUID, db: AsyncSession) -> list[dict]:
    """
    Return ranked carrier candidates for a load using the smart matching engine.
    Pulls available trucks + their drivers and scores them against the load.
    """
    from app.repositories.truck_repo import TruckRepository
    from app.repositories.driver_repo import DriverRepository

    load_repo = LoadRepository(db)
    load = await load_repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()

    truck_repo = TruckRepository(db)
    driver_repo = DriverRepository(db)

    trucks = await truck_repo.list_available()
    candidates: list[CarrierCandidate] = []
    for truck in trucks:
        driver = await driver_repo.get_by_truck(truck.id) if hasattr(driver_repo, "get_by_truck") else None
        candidates.append(CarrierCandidate(
            user_id=str(truck.owner_id),
            truck_id=str(truck.id),
            truck_type=truck.truck_type,
            capacity_tonnes=truck.capacity_tonnes,
            current_lat=truck.current_latitude,
            current_lon=truck.current_longitude,
            service_type=str(getattr(truck, "service_type", "truck")),
        ))

    ranked = rank_carriers(
        candidates=candidates,
        pickup_lat=float(load.pickup_latitude),
        pickup_lon=float(load.pickup_longitude),
        required_truck_type=load.required_truck_type,
        weight_tonnes=float(load.weight_tonnes),
        top_n=10,
    )
    return [
        {
            "rank": i + 1,
            "user_id": r.carrier.user_id,
            "truck_id": r.carrier.truck_id,
            "truck_type": r.carrier.truck_type,
            "capacity_tonnes": r.carrier.capacity_tonnes,
            "score": r.score,
            "breakdown": r.score_breakdown,
        }
        for i, r in enumerate(ranked)
    ]


async def accept_direct_offer(
    load_id: uuid.UUID,
    truck_id: uuid.UUID | None,
    current_user: User,
    db: AsyncSession,
) -> dict:
    """
    Called by the direct-offer recipient. Creates a shipment immediately —
    no bidding round. truck_id can be None for drivers (auto-resolved from profile).
    Returns the accepted load.
    """
    from app.models.truck import Truck
    from app.repositories.driver_repo import DriverRepository
    from app.repositories.truck_repo import TruckRepository
    from app.schemas.load import LoadOut as LoadOutSchema
    from app.repositories.load_carrier_offer_repo import LoadCarrierOfferRepository
    from app.models.load_carrier_offer import CarrierOfferStatus

    load_repo = LoadRepository(db)
    shipment_repo = ShipmentRepository(db)
    offer_repo = LoadCarrierOfferRepository(db)

    load = await load_repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()

    # Authorization: legacy single FK OR junction table row
    carrier_offer = await offer_repo.get(load_id, current_user.id)
    is_legacy = load.direct_offer_user_id == current_user.id
    if not is_legacy and carrier_offer is None:
        raise ForbiddenError("This offer is not for you")
    if load.status != LoadStatus.available:
        raise LoadNotAvailable()

    # Resolve truck
    if not truck_id:
        driver_repo = DriverRepository(db)
        driver_profile = await driver_repo.get_by_user_id(current_user.id)
        if driver_profile and driver_profile.current_truck_id:
            truck_id = driver_profile.current_truck_id
        else:
            # Try via assigned_driver_id on trucks
            truck_repo = TruckRepository(db)
            assigned = await truck_repo.get_by_assigned_driver(current_user.id)
            if assigned:
                truck_id = assigned.id
    if not truck_id:
        raise ForbiddenError("No truck associated with your account")

    # ── Verification gates ────────────────────────────────────────────────────
    from app.models.truck import Truck as _Truck
    _truck_obj = (await db.execute(select(_Truck).where(_Truck.id == truck_id))).scalar_one_or_none()
    if not _truck_obj or not _truck_obj.is_verified:
        raise ForbiddenError(
            "The truck linked to this offer has not been verified. "
            "Submit compliance documents and await admin approval."
        )
    if current_user.role == UserRole.driver:
        from app.repositories.driver_repo import DriverRepository as _DR2
        _dr2 = _DR2(db)
        _dp = await _dr2.get_by_user_id(current_user.id)
        if not _dp or _dp.verification_status != VerificationStatus.approved:
            raise ForbiddenError(
                "Your driver profile must be verified before you can accept loads."
            )

    # ── Cargo type ↔ truck type ────────────────────────────────────────────────
    _required_type = _CARGO_TRUCK_REQUIRED.get(load.cargo_type)
    if _required_type and _truck_obj.truck_type != _required_type:
        raise ForbiddenError(
            f"This load requires a {_required_type.value} truck. "
            f"Your {_truck_obj.truck_type.value} truck is not suitable for this cargo."
        )
    if load.required_truck_type and _truck_obj.truck_type.value != load.required_truck_type:
        raise ForbiddenError(
            f"This load requires a {load.required_truck_type} truck. "
            f"Your {_truck_obj.truck_type.value} truck does not qualify."
        )

    # ── Insurance gate ─────────────────────────────────────────────────────────
    if load.requires_insurance:
        if not _truck_obj.insurance_url:
            raise ForbiddenError(
                "This load requires cargo insurance. Upload your insurance document first."
            )
        if _truck_obj.insurance_expiry and _truck_obj.insurance_expiry < date.today():
            raise ForbiddenError(
                f"Your truck insurance expired on {_truck_obj.insurance_expiry:%d %b %Y}. Renew before accepting."
            )

    # ── NTSA inspection expiry ─────────────────────────────────────────────────
    if _truck_obj.ntsa_inspection_expiry and _truck_obj.ntsa_inspection_expiry < date.today():
        raise ForbiddenError(
            f"Your NTSA inspection expired on {_truck_obj.ntsa_inspection_expiry:%d %b %Y}. Renew before accepting."
        )

    # ── Active job conflict ────────────────────────────────────────────────────
    _shipment_repo_check = ShipmentRepository(db)
    if current_user.role == UserRole.driver:
        _active_shipment = await _shipment_repo_check.get_active_by_driver(current_user.id)
        if _active_shipment:
            _active_load = (await db.execute(select(Load).where(Load.id == _active_shipment.load_id))).scalar_one_or_none()
            _check_timeline_conflict(_active_load, load)
    else:
        _truck_shipment = await _shipment_repo_check.get_active_by_truck(_truck_obj.id)
        if _truck_shipment:
            _truck_active_load = (await db.execute(select(Load).where(Load.id == _truck_shipment.load_id))).scalar_one_or_none()
            if _truck_active_load:
                _check_timeline_conflict(_truck_active_load, load)
            else:
                raise ActiveJobConflict(
                    "This truck is already assigned to an active job. "
                    "Choose a different truck or wait until the current job is complete."
                )
    # ─────────────────────────────────────────────────────────────────────────

    # ── Determine payment mode ────────────────────────────────────────────────
    _use_escrow = getattr(load, "payment_mode", None)
    _use_escrow = (
        _use_escrow.value if hasattr(_use_escrow, "value") else str(_use_escrow or "direct")
    ) == "escrow"

    # ── Pre-flight wallet check — escrow mode only ────────────────────────────
    from app.repositories.wallet_repo import WalletRepository
    _wallet_repo = WalletRepository(db)
    if _use_escrow:
        _wallet = await _wallet_repo.get_by_user(load.shipper_id)
        _available = float(_wallet.balance_kes) if _wallet else 0.0
        _amount = float(load.price_kes)
        if _available < _amount:
            raise InsufficientFunds(shortfall=round(_amount - _available, 2))
    # ─────────────────────────────────────────────────────────────────────────

    # Mark load booked
    await load_repo.update(load, status=LoadStatus.booked)

    # Find driver for shipment
    driver_row = (await db.execute(select(Driver).where(Driver.current_truck_id == truck_id))).scalar_one_or_none()
    if not driver_row:
        truck_row = (await db.execute(select(Truck).where(Truck.id == truck_id))).scalar_one_or_none()
        if truck_row and truck_row.assigned_driver_id:
            driver_row = (await db.execute(select(Driver).where(Driver.id == truck_row.assigned_driver_id))).scalar_one_or_none()
    # Use resolved driver's user_id, or None — never fall back to current_user
    driver_id = driver_row.user_id if driver_row else None

    _load_payment_mode = "escrow" if _use_escrow else "direct"
    delivery_code = (
        None if load.unattended_delivery
        else "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    )
    shipment = await shipment_repo.create(
        load_id=load.id,
        truck_id=truck_id,
        driver_id=driver_id,
        owner_id=current_user.id,
        delivery_code=delivery_code,
        payment_mode=_load_payment_mode,
    )
    if _use_escrow:
        await payment_service.lock_escrow(
            shipment_id=shipment.id,
            shipper_user_id=load.shipper_id,
            amount_kes=float(load.price_kes),
            db=db,
        )
        await shipment_repo.update(shipment, escrow_locked=True)

    route = f"{load.pickup_location.split(',')[0]} → {load.dropoff_location.split(',')[0]}"

    # Blast-offer housekeeping: mark accepted row, cancel remaining rows, notify other carriers
    if carrier_offer:
        await offer_repo.update_status(carrier_offer, CarrierOfferStatus.accepted)
        await offer_repo.cancel_others(load_id, current_user.id)
        other_offers = await offer_repo.list_by_load(load_id)
        for o in other_offers:
            if o.user_id != current_user.id:
                await notification_service.send_notification(
                    user_id=o.user_id,
                    notification_type=NotificationType.direct_offer_response,
                    title="Offer No Longer Available",
                    body=f"The direct load offer for {route} has been accepted by another carrier.",
                    reference_id=load.id,
                    reference_type="load",
                    db=db,
                )

    await notification_service.send_notification(
        user_id=load.shipper_id,
        notification_type=NotificationType.direct_offer_response,
        title="Direct Offer Accepted!",
        body=f"{current_user.full_name} accepted your direct offer for {route}. Shipment is confirmed.",
        reference_id=load.id,
        reference_type="load",
        db=db,
    )
    await MessageRepository(db).create(
        sender_id=current_user.id,
        recipient_id=load.shipper_id,
        subject="Direct offer accepted — shipment confirmed",
        body=(
            f"{current_user.full_name} accepted your direct load offer for {route}. "
            + (
                "This is an unattended delivery — GPS proximity at the dropoff point will confirm delivery automatically."
                if load.unattended_delivery
                else f"Delivery code: {delivery_code[:3]}-{delivery_code[3:]}. Funds are held in escrow until delivery."
            )
        ),
    )
    await MessageRepository(db).create(
        sender_id=load.shipper_id,
        recipient_id=current_user.id,
        subject="Shipment confirmed",
        body=(
            f"You accepted the direct load offer for {route}. "
            + (
                "This is an unattended delivery — your GPS location at the dropoff point will be recorded as proof of delivery."
                if load.unattended_delivery
                else f"Your delivery code is: {delivery_code[:3]}-{delivery_code[3:]}."
            )
        ),
    )

    return LoadOutSchema.model_validate(load)


async def accept_fixed_price_load(
    load_id: uuid.UUID,
    truck_id: uuid.UUID | None,
    current_user: User,
    db: AsyncSession,
) -> dict:
    """
    Carrier accepts a fixed-price load at the shipper's posted price.
    No bidding round, no shipper review — first carrier to commit wins.
    """
    from app.models.truck import Truck
    from app.repositories.driver_repo import DriverRepository
    from app.repositories.truck_repo import TruckRepository
    from app.schemas.load import LoadOut as LoadOutSchema

    load_repo = LoadRepository(db)
    shipment_repo = ShipmentRepository(db)
    bid_repo = BidRepository(db)

    load = await load_repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()
    if load.booking_mode != BookingMode.fixed:
        raise ConflictError("This is not a fixed-price load.")
    if load.status != LoadStatus.available:
        raise LoadNotAvailable()

    # Resolve truck (same as accept_direct_offer)
    if not truck_id:
        driver_repo = DriverRepository(db)
        driver_profile = await driver_repo.get_by_user_id(current_user.id)
        if driver_profile and driver_profile.current_truck_id:
            truck_id = driver_profile.current_truck_id
        else:
            truck_repo = TruckRepository(db)
            assigned = await truck_repo.get_by_assigned_driver(current_user.id)
            if assigned:
                truck_id = assigned.id
    if not truck_id:
        raise ForbiddenError("No truck associated with your account")

    # ── Verification gates ────────────────────────────────────────────────────
    from app.models.truck import Truck as _Truck
    _truck_obj = (await db.execute(select(_Truck).where(_Truck.id == truck_id))).scalar_one_or_none()
    if not _truck_obj or not _truck_obj.is_verified:
        raise ForbiddenError(
            "Your truck has not been verified. "
            "Submit compliance documents and await admin approval."
        )
    if current_user.role == UserRole.driver:
        from app.repositories.driver_repo import DriverRepository as _DR2
        _dr2 = _DR2(db)
        _dp = await _dr2.get_by_user_id(current_user.id)
        if not _dp or _dp.verification_status != VerificationStatus.approved:
            raise ForbiddenError(
                "Your driver profile must be verified before you can accept loads."
            )

    # ── Cargo type ↔ truck type ────────────────────────────────────────────────
    _required_type = _CARGO_TRUCK_REQUIRED.get(load.cargo_type)
    if _required_type and _truck_obj.truck_type != _required_type:
        raise ForbiddenError(
            f"This load requires a {_required_type.value} truck. "
            f"Your {_truck_obj.truck_type.value} truck is not suitable."
        )
    if load.required_truck_type and _truck_obj.truck_type.value != load.required_truck_type:
        raise ForbiddenError(
            f"This load requires a {load.required_truck_type} truck. "
            f"Your {_truck_obj.truck_type.value} truck does not qualify."
        )

    # ── Insurance gate ─────────────────────────────────────────────────────────
    if load.requires_insurance:
        if not _truck_obj.insurance_url:
            raise ForbiddenError(
                "This load requires cargo insurance. Upload your insurance document first."
            )
        if _truck_obj.insurance_expiry and _truck_obj.insurance_expiry < date.today():
            raise ForbiddenError(
                f"Your truck insurance expired on {_truck_obj.insurance_expiry:%d %b %Y}. Renew before accepting."
            )

    # ── NTSA inspection expiry ─────────────────────────────────────────────────
    if _truck_obj.ntsa_inspection_expiry and _truck_obj.ntsa_inspection_expiry < date.today():
        raise ForbiddenError(
            f"Your NTSA inspection expired on {_truck_obj.ntsa_inspection_expiry:%d %b %Y}. Renew before accepting."
        )

    # ── Active job conflict ────────────────────────────────────────────────────
    _shipment_repo_check = ShipmentRepository(db)
    if current_user.role == UserRole.driver:
        _active_shipment = await _shipment_repo_check.get_active_by_driver(current_user.id)
        if _active_shipment:
            _active_load = (await db.execute(select(Load).where(Load.id == _active_shipment.load_id))).scalar_one_or_none()
            _check_timeline_conflict(_active_load, load)
    else:
        _truck_shipment = await _shipment_repo_check.get_active_by_truck(_truck_obj.id)
        if _truck_shipment:
            _truck_active_load = (await db.execute(select(Load).where(Load.id == _truck_shipment.load_id))).scalar_one_or_none()
            if _truck_active_load:
                _check_timeline_conflict(_truck_active_load, load)
            else:
                raise ActiveJobConflict(
                    "This truck is already assigned to an active job. "
                    "Choose a different truck or wait until the current job is complete."
                )
    # ─────────────────────────────────────────────────────────────────────────

    # ── Escrow preflight ──────────────────────────────────────────────────────
    _use_escrow = getattr(load, "payment_mode", None)
    _use_escrow = (
        _use_escrow.value if hasattr(_use_escrow, "value") else str(_use_escrow or "direct")
    ) == "escrow"

    from app.repositories.wallet_repo import WalletRepository
    _wallet_repo = WalletRepository(db)
    if _use_escrow:
        _wallet = await _wallet_repo.get_by_user(load.shipper_id)
        _available = float(_wallet.balance_kes) if _wallet else 0.0
        _amount = float(load.price_kes)
        if _available < _amount:
            raise InsufficientFunds(shortfall=round(_amount - _available, 2))
    # ─────────────────────────────────────────────────────────────────────────

    # Create accepted bid record for audit trail
    await bid_repo.create(
        load_id=load.id,
        owner_id=current_user.id,
        truck_id=truck_id,
        amount_kes=float(load.price_kes),
        status=BidStatus.accepted,
    )

    # Book the load
    await load_repo.update(load, status=LoadStatus.booked)

    # Find driver for shipment
    driver_row = (await db.execute(select(Driver).where(Driver.current_truck_id == truck_id))).scalar_one_or_none()
    if not driver_row:
        truck_row = (await db.execute(select(Truck).where(Truck.id == truck_id))).scalar_one_or_none()
        if truck_row and truck_row.assigned_driver_id:
            driver_row = (await db.execute(select(Driver).where(Driver.id == truck_row.assigned_driver_id))).scalar_one_or_none()
    driver_id = driver_row.user_id if driver_row else None

    _load_payment_mode = "escrow" if _use_escrow else "direct"
    delivery_code = (
        None if load.unattended_delivery
        else "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    )
    shipment = await shipment_repo.create(
        load_id=load.id,
        truck_id=truck_id,
        driver_id=driver_id,
        owner_id=current_user.id,
        delivery_code=delivery_code,
        payment_mode=_load_payment_mode,
    )
    if _use_escrow:
        await payment_service.lock_escrow(
            shipment_id=shipment.id,
            shipper_user_id=load.shipper_id,
            amount_kes=float(load.price_kes),
            db=db,
        )
        await shipment_repo.update(shipment, escrow_locked=True)

    route = f"{load.pickup_location.split(',')[0]} → {load.dropoff_location.split(',')[0]}"

    await notification_service.send_notification(
        user_id=load.shipper_id,
        notification_type=NotificationType.direct_offer_response,
        title="Load Booked at Fixed Price!",
        body=f"{current_user.full_name} accepted your fixed-price load for {route} at KES {load.price_kes:,.0f}. Shipment confirmed.",
        reference_id=load.id,
        reference_type="load",
        db=db,
    )
    await MessageRepository(db).create(
        sender_id=current_user.id,
        recipient_id=load.shipper_id,
        subject="Fixed-price load booked — shipment confirmed",
        body=(
            f"{current_user.full_name} accepted your fixed-price load for {route} at KES {load.price_kes:,.0f}. "
            + (
                "This is an unattended delivery — GPS proximity at the dropoff will confirm delivery automatically."
                if load.unattended_delivery
                else f"Delivery code: {delivery_code[:3]}-{delivery_code[3:]}."
            )
        ),
    )
    await notification_service.send_notification(
        user_id=current_user.id,
        notification_type=NotificationType.bid_accepted,
        title="Job Confirmed!",
        body=f"You've confirmed the job for {route} at KES {load.price_kes:,.0f}.",
        reference_id=load.id,
        reference_type="load",
        db=db,
    )
    await MessageRepository(db).create(
        sender_id=load.shipper_id,
        recipient_id=current_user.id,
        subject="Shipment confirmed",
        body=(
            f"You confirmed the fixed-price job for {route} at KES {load.price_kes:,.0f}. "
            + (
                "This is an unattended delivery — your GPS at the dropoff will be recorded as proof of delivery."
                if load.unattended_delivery
                else f"Your delivery code is: {delivery_code[:3]}-{delivery_code[3:]}."
            )
        ),
    )

    return LoadOutSchema.model_validate(load)


async def reject_direct_offer(
    load_id: uuid.UUID,
    reason: str | None,
    current_user: User,
    db: AsyncSession,
) -> dict:
    from app.repositories.load_carrier_offer_repo import LoadCarrierOfferRepository
    from app.models.load_carrier_offer import CarrierOfferStatus
    from app.schemas.load import LoadOut as LoadOutSchema

    load_repo = LoadRepository(db)
    offer_repo = LoadCarrierOfferRepository(db)

    load = await load_repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()

    carrier_offer = await offer_repo.get(load_id, current_user.id)
    is_legacy = load.direct_offer_user_id == current_user.id
    if not is_legacy and carrier_offer is None:
        raise ForbiddenError("This offer is not for you")
    if load.status != LoadStatus.available:
        raise LoadNotAvailable()

    route = f"{load.pickup_location.split(',')[0]} → {load.dropoff_location.split(',')[0]}"
    reason_text = f" Reason: {reason}" if reason else ""

    if carrier_offer:
        # Blast mode: mark this carrier's row as rejected; load stays alive for recovery
        await offer_repo.update_status(carrier_offer, CarrierOfferStatus.rejected)
        all_offers = await offer_repo.list_by_load(load_id)
        terminal = {CarrierOfferStatus.rejected, CarrierOfferStatus.cancelled}
        all_declined = all(o.status in terminal for o in all_offers)
    else:
        # Legacy single-carrier: load stays available for shipper to re-offer or convert
        all_declined = True

    decline_hint = (
        " All carriers have declined — you can re-offer or open it to bidding from your Active Loads page."
        if all_declined else ""
    )

    await notification_service.send_notification(
        user_id=load.shipper_id,
        notification_type=NotificationType.direct_offer_response,
        title="Direct Offer Declined",
        body=f"{current_user.full_name} declined your direct offer.{reason_text}{decline_hint}",
        reference_id=load.id,
        reference_type="load",
        db=db,
    )
    await MessageRepository(db).create(
        sender_id=current_user.id,
        recipient_id=load.shipper_id,
        subject="Direct offer declined",
        body=(
            f"{current_user.full_name} declined your direct load offer for {route}."
            + (f"\n\nReason: {reason}" if reason else "")
        ),
    )

    return LoadOutSchema.model_validate(load)


async def list_my_bids(current_user: User, db: AsyncSession) -> list[BidWithLoadOut]:
    bid_repo = BidRepository(db)
    bids = await bid_repo.list_by_owner_with_load(current_user.id)
    return [BidWithLoadOut.model_validate(b) for b in bids]
