import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.bid import Bid
from app.models.load import Load, LoadStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.repositories.load_repo import LoadRepository
from app.repositories.notification_repo import NotificationRepository
from app.schemas.load import LoadCreate, LoadListOut, LoadOut, LoadUpdate, PublicLoadOut
from app.services import bid_service, load_service, notification_service
from app.services.pricing_service import estimate_price


class OfferResponse(BaseModel):
    accept: bool
    truck_id: uuid.UUID | None = None
    reason: str | None = None
    notification_id: uuid.UUID | None = None

router = APIRouter(tags=["loads"])


@router.get("/price-estimate")
async def price_estimate(
    distance_km: float = Query(..., gt=0, description="Road distance in km"),
    service_type: str = Query("truck"),
    cargo_type: str = Query("general"),
    urgency: str = Query("standard", description="same_day | next_day | standard | flexible"),
    demand_factor: float = Query(1.0, ge=0.5, le=3.0),
    country: str = Query("KE", description="ISO-2 country code for VAT lookup"),
    db: AsyncSession = Depends(get_db),
):
    """Public price estimate. Applies country-specific VAT and commission from DB config."""
    from app.models.country_config import CountryConfig
    from app.models.platform_config import PlatformConfig
    cc = (await db.execute(
        select(CountryConfig).where(CountryConfig.country_code == country.upper())
    )).scalar_one_or_none()
    vat_rate = float(cc.vat_rate) if cc else 0.16

    pc = (await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.country_code == country.upper(),
            PlatformConfig.service_type == service_type,
            PlatformConfig.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    commission_rate = float(
        pc.carrier_commission_rate if pc and pc.carrier_commission_rate is not None
        else (pc.commission_rate if pc else 0.07)
    )

    est = estimate_price(
        distance_km=distance_km,
        service_type=service_type,
        cargo_type=cargo_type,
        urgency=urgency,
        demand_factor=demand_factor,
        commission_rate=commission_rate,
        vat_rate=vat_rate,
    )
    return {
        "total_price_kes": est.total_price_kes,
        "min_bid_floor_kes": round(est.total_price_kes * 0.70, -2),
        "platform_fee_kes": est.platform_fee_kes,
        "owner_payout_kes": est.owner_payout_kes,
        "vat_kes": est.vat_kes,
        "total_with_vat_kes": est.total_with_vat_kes,
        "breakdown": est.breakdown,
    }


@router.get("/public", response_model=list[PublicLoadOut])
async def public_loads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    bid_count_subq = (
        select(func.count(Bid.id))
        .where(Bid.load_id == Load.id)
        .correlate(Load)
        .scalar_subquery()
    )
    stmt = (
        select(Load, bid_count_subq.label("bid_count"))
        .options(selectinload(Load.shipper))
        .where(Load.status == LoadStatus.available)
        .order_by(Load.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()
    return [
        PublicLoadOut(
            id=row.Load.id,
            pickup_location=row.Load.pickup_location,
            dropoff_location=row.Load.dropoff_location,
            corridor=row.Load.corridor,
            cargo_type=row.Load.cargo_type,
            weight_tonnes=row.Load.weight_tonnes,
            required_truck_type=row.Load.required_truck_type,
            price_kes=float(row.Load.price_kes),
            distance_km=row.Load.distance_km,
            pickup_date=row.Load.pickup_date,
            created_at=row.Load.created_at,
            bid_count=row.bid_count or 0,
            shipper_name=row.Load.shipper_name,
            shipper_company=row.Load.shipper_company,
        )
        for row in rows
    ]


@router.get("/marketplace", response_model=LoadListOut)
async def marketplace(
    cargo_type: str | None = Query(None),
    corridor: str | None = Query(None),
    near_lat: float | None = Query(None, description="Filter loads whose pickup is within radius_km of this latitude"),
    near_lon: float | None = Query(None),
    radius_km: float | None = Query(100.0, description="Radius in km for proximity filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.get_marketplace(
        cargo_type, corridor, page, page_size, db,
        near_lat=near_lat, near_lon=near_lon, radius_km=radius_km,
    )


@router.post("", response_model=LoadOut, status_code=201)
async def create_load(
    payload: LoadCreate,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.create_load(payload, current_user, db)


@router.get("/mine", response_model=LoadListOut)
async def my_loads(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.get_shipper_loads(current_user.id, status, page, page_size, db)


@router.get("/fleet", response_model=LoadListOut)
async def owner_fleet_loads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.get_owner_loads(current_user.id, page, page_size, db)


@router.get("/my-drives", response_model=LoadListOut)
async def my_drives(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.get_driver_loads(current_user.id, page, page_size, db)


@router.get("/my-direct-offers", response_model=list[LoadOut])
async def my_direct_offers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return pending direct load offers addressed to the current user."""
    repo = LoadRepository(db)
    loads = await repo.list_direct_offers_for_user(current_user.id)
    return [LoadOut.model_validate(l) for l in loads]


@router.get("/{load_id}", response_model=LoadOut)
async def get_load(
    load_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.get_load(load_id, db)


@router.patch("/{load_id}", response_model=LoadOut)
async def update_load(
    load_id: uuid.UUID,
    payload: LoadUpdate,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.update_load(load_id, payload, current_user, db)


@router.delete("/{load_id}", response_model=LoadOut)
async def cancel_load(
    load_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.cancel_load(load_id, current_user, db)


@router.get("/{load_id}/suggested-carriers")
async def suggested_carriers(
    load_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return ranked carrier candidates for a load using the smart matching engine."""
    return await bid_service.get_suggested_carriers(load_id, db)


@router.post("/{load_id}/offer-response", response_model=LoadOut)
async def respond_to_direct_offer(
    load_id: uuid.UUID,
    payload: OfferResponse,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Direct-offer recipient accepts (creates shipment immediately) or declines with a reason."""
    from app.core.exceptions import BidNotFound, ForbiddenError, LoadNotAvailable, LoadNotFound

    if payload.notification_id:
        notif_repo = NotificationRepository(db)
        await notif_repo.mark_read(payload.notification_id, current_user.id)

    try:
        if payload.accept:
            result = await bid_service.accept_direct_offer(load_id, payload.truck_id, current_user, db)
        else:
            result = await bid_service.reject_direct_offer(load_id, payload.reason, current_user, db)
    except LoadNotFound:
        raise HTTPException(status_code=404, detail="Load not found")
    except ForbiddenError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except LoadNotAvailable:
        raise HTTPException(status_code=409, detail="Offer already responded to")

    return result
