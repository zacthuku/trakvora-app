import math
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, LoadNotFound
from app.core.utils import detect_corridor
from app.models.load import BookingMode, LoadStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.repositories.load_repo import LoadRepository
from app.schemas.load import LoadCreate, LoadOut, LoadUpdate, ReOfferRequest
from app.services import notification_service
from app.services.pricing_service import estimate_price, suggest_min_bid


async def create_load(payload: LoadCreate, current_user: User, db: AsyncSession) -> LoadOut:
    repo = LoadRepository(db)
    corridor = detect_corridor(
        payload.pickup_latitude,
        payload.pickup_longitude,
        payload.dropoff_latitude,
        payload.dropoff_longitude,
    )

    data = payload.model_dump()
    data.pop("direct_offer_user_ids", None)  # handled separately below; not a DB column

    # Auto-suggest min_bid_floor_kes for auction loads when not set by shipper
    if payload.booking_mode == BookingMode.auction and not payload.min_bid_floor_kes and payload.distance_km:
        service_type = str(data.get("service_type", "truck"))
        cargo_type = str(data.get("cargo_type", "general"))
        data["min_bid_floor_kes"] = suggest_min_bid(
            distance_km=float(payload.distance_km),
            service_type=service_type,
            cargo_type=cargo_type,
        )

    load = await repo.create(
        shipper_id=current_user.id,
        corridor=corridor,
        **data,
    )

    route = f"{payload.pickup_location.split(',')[0]} → {payload.dropoff_location.split(',')[0]}"

    if payload.booking_mode == BookingMode.direct and payload.direct_offer_user_ids:
        # Blast offer — notify up to 5 carriers; first to accept wins
        from app.repositories.load_carrier_offer_repo import LoadCarrierOfferRepository
        offer_repo = LoadCarrierOfferRepository(db)
        for uid in payload.direct_offer_user_ids[:5]:
            await offer_repo.create(load_id=load.id, user_id=uid)
            await notification_service.send_notification(
                user_id=uid,
                notification_type=NotificationType.direct_offer,
                title="Direct Load Offer",
                body=f"{current_user.full_name} is offering you a direct load: {route}. KES {int(payload.price_kes):,}. First to accept wins.",
                reference_id=load.id,
                reference_type="load",
                db=db,
            )
    elif payload.booking_mode == BookingMode.direct and payload.direct_offer_user_id:
        # Legacy single-carrier path
        await notification_service.send_notification(
            user_id=payload.direct_offer_user_id,
            notification_type=NotificationType.direct_offer,
            title="Direct Load Offer",
            body=f"{current_user.full_name} is offering you a direct load: {route}. KES {int(payload.price_kes):,}",
            reference_id=load.id,
            reference_type="load",
            db=db,
        )

    return LoadOut.model_validate(load)


async def get_load(load_id: uuid.UUID, db: AsyncSession) -> LoadOut:
    repo = LoadRepository(db)
    load = await repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()
    return LoadOut.model_validate(load)


async def update_load(load_id: uuid.UUID, payload: LoadUpdate, current_user: User, db: AsyncSession) -> LoadOut:
    repo = LoadRepository(db)
    load = await repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()
    if load.shipper_id != current_user.id:
        raise ForbiddenError()
    updated = await repo.update(load, **{k: v for k, v in payload.model_dump().items() if v is not None})
    return LoadOut.model_validate(updated)


async def cancel_load(load_id: uuid.UUID, current_user: User, db: AsyncSession) -> LoadOut:
    repo = LoadRepository(db)
    load = await repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()
    if load.shipper_id != current_user.id:
        raise ForbiddenError()
    updated = await repo.update(load, status=LoadStatus.cancelled)
    return LoadOut.model_validate(updated)


async def get_shipper_loads(
    shipper_id: uuid.UUID,
    status: str | None,
    page: int,
    page_size: int,
    db: AsyncSession,
) -> dict:
    from sqlalchemy import select as sa_select
    from app.models.load_carrier_offer import CarrierOfferStatus, LoadCarrierOffer

    repo = LoadRepository(db)
    items, total = await repo.list_by_shipper(shipper_id, status=status, page=page, page_size=page_size)

    # Batch-compute all_offers_declined for direct loads (2 queries, not N+1)
    direct_load_ids = [i.id for i in items if i.booking_mode == BookingMode.direct]
    declined_ids: set = set()
    if direct_load_ids:
        loads_with_pending = {
            row[0] for row in (await db.execute(
                sa_select(LoadCarrierOffer.load_id)
                .where(
                    LoadCarrierOffer.load_id.in_(direct_load_ids),
                    LoadCarrierOffer.status == CarrierOfferStatus.pending,
                )
                .group_by(LoadCarrierOffer.load_id)
            )).all()
        }
        loads_with_any = {
            row[0] for row in (await db.execute(
                sa_select(LoadCarrierOffer.load_id)
                .where(LoadCarrierOffer.load_id.in_(direct_load_ids))
                .group_by(LoadCarrierOffer.load_id)
            )).all()
        }
        declined_ids = loads_with_any - loads_with_pending

    result_items = []
    for i in items:
        out = LoadOut.model_validate(i)
        out.all_offers_declined = i.id in declined_ids
        result_items.append(out)

    return {
        "items": result_items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def re_offer_load(
    load_id: uuid.UUID,
    payload: ReOfferRequest,
    current_user: User,
    db: AsyncSession,
) -> LoadOut:
    from app.repositories.load_carrier_offer_repo import LoadCarrierOfferRepository
    from app.models.load_carrier_offer import CarrierOfferStatus

    repo = LoadRepository(db)
    offer_repo = LoadCarrierOfferRepository(db)

    load = await repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()
    if load.shipper_id != current_user.id:
        raise ForbiddenError()
    if load.status != LoadStatus.available:
        raise ConflictError(detail="Load is not available for re-offering")
    if load.booking_mode != BookingMode.direct:
        raise ConflictError(detail="Only direct loads can be re-offered")

    all_offers = await offer_repo.list_by_load(load_id)
    terminal = {CarrierOfferStatus.rejected, CarrierOfferStatus.cancelled}
    if all_offers and not all(o.status in terminal for o in all_offers):
        raise ConflictError(detail="Cannot re-offer while offers are still pending")

    if payload.price_kes is not None:
        load = await repo.update(load, price_kes=payload.price_kes)

    route = f"{load.pickup_location.split(',')[0]} → {load.dropoff_location.split(',')[0]}"
    price_display = int(payload.price_kes or load.price_kes)

    for uid in payload.user_ids[:5]:
        await offer_repo.upsert_pending(load_id=load.id, user_id=uid)
        await notification_service.send_notification(
            user_id=uid,
            notification_type=NotificationType.direct_offer,
            title="Direct Load Offer",
            body=f"{current_user.full_name} is offering you a direct load: {route}. KES {price_display:,}. First to accept wins.",
            reference_id=load.id,
            reference_type="load",
            db=db,
        )

    out = LoadOut.model_validate(load)
    out.all_offers_declined = False
    return out


async def convert_to_bid(
    load_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> LoadOut:
    from app.repositories.load_carrier_offer_repo import LoadCarrierOfferRepository
    from app.models.load_carrier_offer import CarrierOfferStatus

    repo = LoadRepository(db)
    offer_repo = LoadCarrierOfferRepository(db)

    load = await repo.get_by_id(load_id)
    if not load:
        raise LoadNotFound()
    if load.shipper_id != current_user.id:
        raise ForbiddenError()
    if load.status != LoadStatus.available:
        raise ConflictError(detail="Load is not available for conversion")
    if load.booking_mode != BookingMode.direct:
        raise ConflictError(detail="Load is already in auction or fixed mode")

    all_offers = await offer_repo.list_by_load(load_id)
    terminal = {CarrierOfferStatus.rejected, CarrierOfferStatus.cancelled}
    if all_offers and not all(o.status in terminal for o in all_offers):
        raise ConflictError(detail="Cannot convert while offers are still pending")

    load = await repo.update(load, booking_mode=BookingMode.auction, direct_offer_user_id=None)

    out = LoadOut.model_validate(load)
    out.all_offers_declined = False
    return out


async def get_owner_loads(
    owner_id: uuid.UUID,
    page: int,
    page_size: int,
    db: AsyncSession,
) -> dict:
    repo = LoadRepository(db)
    items, total = await repo.list_by_owner_shipments(owner_id, page=page, page_size=page_size)
    return {
        "items": [LoadOut.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_driver_loads(
    driver_id: uuid.UUID,
    page: int,
    page_size: int,
    db: AsyncSession,
) -> dict:
    repo = LoadRepository(db)
    items, total = await repo.list_by_driver_shipments(driver_id, page=page, page_size=page_size)
    return {
        "items": [LoadOut.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def get_marketplace(
    cargo_type: str | None,
    corridor: str | None,
    page: int,
    page_size: int,
    db: AsyncSession,
    near_lat: float | None = None,
    near_lon: float | None = None,
    radius_km: float | None = 100.0,
    truck_type: str | None = None,
    urgent: bool | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    sort: str | None = None,
    carrier_user_id=None,
) -> dict:
    repo = LoadRepository(db)
    items, total = await repo.list_marketplace(
        cargo_type=cargo_type, corridor=corridor, page=page, page_size=page_size,
        truck_type=truck_type, urgent=urgent, min_price=min_price, max_price=max_price, sort=sort,
        carrier_user_id=carrier_user_id,
    )

    # Apply proximity filter in-memory when near_lat/near_lon are provided
    if near_lat is not None and near_lon is not None and radius_km:
        filtered = [
            i for i in items
            if i.pickup_latitude is not None
            and i.pickup_longitude is not None
            and _haversine_km(near_lat, near_lon, i.pickup_latitude, i.pickup_longitude) <= radius_km
        ]
        return {
            "items": [LoadOut.model_validate(i) for i in filtered],
            "total": len(filtered),
            "page": page,
            "page_size": page_size,
        }

    return {
        "items": [LoadOut.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
