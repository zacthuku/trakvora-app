import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.subscription_limits import get_effective_plan
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.bid import Bid
from app.models.load import Load, LoadStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.repositories.load_repo import LoadRepository
from app.repositories.notification_repo import NotificationRepository
from app.schemas.load import LoadCreate, LoadListOut, LoadOut, LoadUpdate, PublicLoadOut, ReOfferRequest
from app.services import bid_service, load_service, notification_service
from app.services.pricing_service import estimate_price


class OfferResponse(BaseModel):
    accept: bool
    truck_id: uuid.UUID | None = None
    reason: str | None = None
    notification_id: uuid.UUID | None = None


class AcceptFixedRequest(BaseModel):
    truck_id: uuid.UUID | None = None


router = APIRouter(tags=["loads"])


@router.get("/price-estimate")
async def price_estimate(
    distance_km:      float = Query(..., gt=0,  description="Road distance in km"),
    service_type:     str   = Query("truck"),
    cargo_type:       str   = Query("general"),
    urgency:          str   = Query("standard", description="same_day | next_day | standard | flexible"),
    country:          str   = Query("KE",       description="ISO-2 country code"),
    pickup_location:  str   = Query("",         description="Pickup location name for corridor detection"),
    dropoff_location: str   = Query("",         description="Dropoff location name for corridor detection"),
    weight_tonnes:    float = Query(0.0,        description="Cargo weight in tonnes (improves accuracy)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Smart price estimate. Uses corridor-specific rates, live fuel index, seasonal factor,
    real-time platform demand, and historical accepted-bid intelligence.
    """
    from app.models.country_config import CountryConfig
    from app.models.corridor_rate import CorridorRate
    from app.models.fuel_index import FuelIndex
    from app.models.platform_config import PlatformConfig
    from app.models.price_intelligence import PriceIntelligence
    from app.services.pricing_service import (
        _distance_band, _weight_band, detect_corridor, get_demand_factor, get_seasonal_factor,
    )

    country_upper = country.upper()

    # ── Country config (VAT + commission) ────────────────────────────────────
    cc = (await db.execute(
        select(CountryConfig).where(CountryConfig.country_code == country_upper)
    )).scalar_one_or_none()
    vat_rate = float(cc.vat_rate) if cc else 0.16

    pc = (await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.country_code == country_upper,
            PlatformConfig.service_type == service_type,
            PlatformConfig.is_active.is_(True),
        )
    )).scalar_one_or_none()
    commission_rate = float(
        pc.carrier_commission_rate if pc and pc.carrier_commission_rate is not None
        else (pc.commission_rate if pc else 0.07)
    )

    # ── Corridor detection ────────────────────────────────────────────────────
    corridor_key  = detect_corridor(pickup_location, dropoff_location)

    # ── Corridor base rate from DB ────────────────────────────────────────────
    rate_row = (await db.execute(
        select(CorridorRate).where(
            CorridorRate.country_code == country_upper,
            CorridorRate.corridor_key == corridor_key,
            CorridorRate.is_active.is_(True),
        )
    )).scalar_one_or_none()

    if not rate_row and corridor_key != "default":
        rate_row = (await db.execute(
            select(CorridorRate).where(
                CorridorRate.country_code == country_upper,
                CorridorRate.corridor_key == "default",
                CorridorRate.is_active.is_(True),
            )
        )).scalar_one_or_none()

    base_rate_override = float(rate_row.base_rate) if rate_row else None
    corridor_name      = rate_row.corridor_name if rate_row else None

    # ── Fuel index ────────────────────────────────────────────────────────────
    fuel_row = (await db.execute(
        select(FuelIndex).where(FuelIndex.country_code == country_upper)
    )).scalar_one_or_none()
    fuel_adjustment_factor = float(fuel_row.fuel_adjustment_factor) if fuel_row else 1.0

    # ── Seasonal factor ───────────────────────────────────────────────────────
    seasonal_factor = get_seasonal_factor(country_upper)

    # ── Platform demand factor (in-memory, updated every 30min) ─────────────
    demand_factor = get_demand_factor(corridor_key)

    # ── Core estimate ─────────────────────────────────────────────────────────
    est = estimate_price(
        distance_km            = distance_km,
        service_type           = service_type,
        cargo_type             = cargo_type,
        urgency                = urgency,
        demand_factor          = demand_factor,
        commission_rate        = commission_rate,
        vat_rate               = vat_rate,
        base_rate_override     = base_rate_override,
        weight_tonnes          = weight_tonnes,
        fuel_adjustment_factor = fuel_adjustment_factor,
        seasonal_factor        = seasonal_factor,
    )

    # ── Market intelligence (from nightly-refreshed PriceIntelligence) ───────
    dist_band = _distance_band(distance_km)
    wt_band   = _weight_band(weight_tonnes)

    intel = (await db.execute(
        select(PriceIntelligence).where(
            PriceIntelligence.corridor_key  == corridor_key,
            PriceIntelligence.cargo_type    == cargo_type,
            PriceIntelligence.distance_band == dist_band,
            PriceIntelligence.weight_band   == wt_band,
        )
    )).scalar_one_or_none()

    # Fallback: try "default" corridor if specific corridor has no data yet
    if not intel and corridor_key != "default":
        intel = (await db.execute(
            select(PriceIntelligence).where(
                PriceIntelligence.corridor_key  == "default",
                PriceIntelligence.cargo_type    == cargo_type,
                PriceIntelligence.distance_band == dist_band,
                PriceIntelligence.weight_band   == wt_band,
            )
        )).scalar_one_or_none()

    # ── Build confidence and market range ─────────────────────────────────────
    if intel and intel.sample_count >= 20:
        confidence = "high"
    elif intel and intel.sample_count >= 5:
        confidence = "medium"
    elif intel and intel.sample_count >= 1:
        confidence = "low"
    else:
        confidence = "formula_only"

    market_range = None
    if intel:
        market_range = {
            "low_kes":         round(intel.p25_per_km * distance_km, -2),
            "recommended_kes": round(intel.p50_per_km * distance_km, -2),
            "premium_kes":     round(intel.p75_per_km * distance_km, -2),
        }

    # Suggested posting price: market p50 + 5% buffer (so bids have room), or formula
    suggested_price = round((market_range["recommended_kes"] * 1.05), -2) if market_range else est.total_price_kes

    market_insight = None
    if intel and intel.sample_count > 0:
        market_insight = (
            f"{intel.sample_count} similar load{'s' if intel.sample_count != 1 else ''} on this route. "
            f"Median accepted price: {market_range['recommended_kes']:,.0f} — "
            f"carriers typically bid 5–12% below the posted price."
        )

    return {
        "formula_estimate_kes": est.total_price_kes,
        "suggested_price_kes":  suggested_price,
        "market_range":         market_range,
        "confidence":           confidence,
        "sample_count":         intel.sample_count if intel else 0,
        "corridor_key":         corridor_key,
        "corridor_name":        corridor_name,
        "market_insight":       market_insight,
        "seasonal_factor":      seasonal_factor,
        "fuel_adjustment_factor": fuel_adjustment_factor,
        "demand_factor":        demand_factor,
        "min_bid_floor_kes":    round(suggested_price * 0.70, -2),
        "platform_fee_kes":     est.platform_fee_kes,
        "owner_payout_kes":     est.owner_payout_kes,
        "vat_kes":              est.vat_kes,
        "total_with_vat_kes":   est.total_with_vat_kes,
        "breakdown":            est.breakdown,
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
    truck_type: str | None = Query(None),
    urgent: bool | None = Query(None),
    min_price: float | None = Query(None),
    max_price: float | None = Query(None),
    sort: str | None = Query(None, description="newest|price_asc|price_desc|urgent"),
    near_lat: float | None = Query(None),
    near_lon: float | None = Query(None),
    radius_km: float | None = Query(100.0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await load_service.get_marketplace(
        cargo_type, corridor, page, page_size, db,
        near_lat=near_lat, near_lon=near_lon, radius_km=radius_km,
        truck_type=truck_type, urgent=urgent, min_price=min_price, max_price=max_price, sort=sort,
        carrier_user_id=current_user.id,
    )


@router.post("", response_model=LoadOut, status_code=201)
async def create_load(
    payload: LoadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    can_post = current_user.role == UserRole.shipper or (
        current_user.role in (UserRole.owner, UserRole.driver) and current_user.can_ship
    )
    if not can_post:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError()
    if getattr(payload, "payment_mode", None) and str(payload.payment_mode) == "escrow" and not current_user.can_use_escrow:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError()
    plan = await get_effective_plan(current_user.id, db)
    if plan and plan.max_loads_per_month is not None:
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        load_count = (await db.execute(
            select(func.count(Load.id)).where(
                Load.shipper_id == current_user.id,
                Load.created_at >= month_start,
            )
        )).scalar() or 0
        if load_count >= plan.max_loads_per_month:
            raise HTTPException(
                status_code=402,
                detail=f"Your {plan.name} plan allows {plan.max_loads_per_month} load(s) per month. Upgrade your plan to post more.",
            )
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


@router.get("/{load_id}/carrier-offer-status")
async def carrier_offer_status(
    load_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the per-carrier status of a blast offer (shipper only)."""
    from app.repositories.load_carrier_offer_repo import LoadCarrierOfferRepository
    from app.models.user import User as UserModel
    from sqlalchemy import select as sa_select

    load_repo_inner = LoadRepository(db)
    load = await load_repo_inner.get_by_id(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    if load.shipper_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the shipper can view offer status")

    offer_repo = LoadCarrierOfferRepository(db)
    offers = await offer_repo.list_by_load(load_id)
    result = []
    for o in offers:
        user = (await db.execute(sa_select(UserModel).where(UserModel.id == o.user_id))).scalar_one_or_none()
        result.append({
            "user_id": str(o.user_id),
            "full_name": user.full_name if user else None,
            "status": o.status.value,
            "responded_at": o.responded_at.isoformat() if o.responded_at else None,
        })
    return result


@router.post("/{load_id}/re-offer", response_model=LoadOut)
async def re_offer_load(
    load_id: uuid.UUID,
    payload: ReOfferRequest,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    """Re-offer a direct load to a new (or same) carrier set after all offers were declined."""
    from app.core.exceptions import ConflictError
    try:
        return await load_service.re_offer_load(load_id, payload, current_user, db)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=e.detail)


@router.patch("/{load_id}/convert-to-bid", response_model=LoadOut)
async def convert_load_to_bid(
    load_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    """Convert a declined direct load to auction mode so any carrier can bid."""
    from app.core.exceptions import ConflictError
    try:
        return await load_service.convert_to_bid(load_id, current_user, db)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=e.detail)


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
    except Exception as e:
        from app.core.exceptions import InsufficientFunds
        if isinstance(e, InsufficientFunds):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "insufficient_funds",
                    "message": "Insufficient wallet balance to lock escrow for this shipment.",
                    "shortfall_kes": e.shortfall,
                },
            )
        raise

    return result


@router.post("/{load_id}/accept-fixed", response_model=LoadOut)
async def accept_fixed_price(
    load_id: uuid.UUID,
    payload: AcceptFixedRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Carrier accepts a fixed-price load at the posted price — no bidding, no shipper review."""
    from app.core.exceptions import ConflictError, ForbiddenError, InsufficientFunds, LoadNotAvailable, LoadNotFound
    from app.models.user import UserRole

    if current_user.role not in (UserRole.owner, UserRole.driver):
        raise HTTPException(status_code=403, detail="Only carriers can accept loads")

    try:
        return await bid_service.accept_fixed_price_load(load_id, payload.truck_id, current_user, db)
    except LoadNotFound:
        raise HTTPException(status_code=404, detail="Load not found")
    except ForbiddenError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except (LoadNotAvailable, ConflictError) as e:
        raise HTTPException(status_code=409, detail=getattr(e, "detail", str(e)))
    except InsufficientFunds as e:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "insufficient_funds",
                "message": "Insufficient wallet balance to lock escrow for this shipment.",
                "shortfall_kes": e.shortfall,
            },
        )


@router.post("/bulk-upload")
async def bulk_upload_loads(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a CSV file with multiple loads.

    CSV columns (header required):
        pickup_location, pickup_lat, pickup_long,
        dropoff_location, dropoff_lat, dropoff_long,
        cargo_type, weight_tonnes, price_kes,
        pickup_date, delivery_date, notes

    Returns:
        {"created": N, "failed": [{"row": N, "error": "..."}]}
    """
    import csv
    import io

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    created_count = 0
    failures = []

    for i, row in enumerate(reader, start=2):  # row 1 = header
        try:
            payload = LoadCreate(
                pickup_location=row["pickup_location"].strip(),
                pickup_latitude=float(row["pickup_lat"]),
                pickup_longitude=float(row["pickup_long"]),
                dropoff_location=row["dropoff_location"].strip(),
                dropoff_latitude=float(row["dropoff_lat"]),
                dropoff_longitude=float(row["dropoff_long"]),
                cargo_type=row.get("cargo_type", "general").strip() or "general",
                weight_tonnes=float(row["weight_tonnes"]),
                price_kes=float(row["price_kes"]),
                pickup_date=row.get("pickup_date") or None,
                delivery_date=row.get("delivery_date") or None,
                special_instructions=row.get("notes") or None,
            )
            await load_service.create_load(payload, current_user, db)
            created_count += 1
        except Exception as exc:
            failures.append({"row": i, "error": str(exc)})

    return {"created": created_count, "failed": failures}
