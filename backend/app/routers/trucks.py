import secrets
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError, TruckNotFound
from app.core.subscription_limits import get_effective_plan
from app.models.driver import VerificationStatus
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.onboarding_fee import OnboardingFeeRecord, OnboardingFeeStatus
from app.models.truck import Truck
from app.models.user import User, UserRole
from app.repositories.driver_repo import DriverRepository
from app.repositories.truck_repo import TruckRepository
from app.schemas.driver import AssignDriverRequest
from app.schemas.truck import TruckCreate, TruckDocumentSubmit, TruckOut, TruckUpdate, PublicTruckOut, NearbyTruckOut

from app.services.ntsa_service import verify_plate as ntsa_verify_plate

router = APIRouter(tags=["trucks"])

# Onboarding fee schedule (KES) — PRD §4.2
ONBOARDING_FEE_KES: dict[str, int] = {
    "motorcycle_courier": 500,
    "cargo_bike":         500,
    "van":                750,
    "pickup":             1_000,
    "dry_van":            1_500,
    "tipper":             2_000,
    "flatbed":            2_000,
    "reefer":             3_000,
    "tanker":             3_000,
    "lowbed":             5_000,
}


async def _run_plate_check(truck_id: uuid.UUID, plate: str) -> None:
    """Background task: verify truck registration plate via YourVerify and save result."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        repo = TruckRepository(db)
        truck = await repo.get_by_id(truck_id)
        if not truck:
            return
        await repo.update(truck, reg_check_status="pending")
        passed, owner_name, detail = await ntsa_verify_plate(plate)
        await repo.update(
            truck,
            reg_check_status="passed" if passed else "failed",
            reg_check_at=datetime.now(timezone.utc),
            reg_check_detail=detail,
            reg_check_owner=owner_name,
        )


@router.get("", response_model=list[TruckOut])
async def list_my_trucks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owners get their fleet; drivers get their owned truck(s)."""
    repo = TruckRepository(db)
    trucks = await repo.list_by_owner(current_user.id)
    return trucks


@router.post("", response_model=TruckOut, status_code=201)
async def create_truck(
    payload: TruckCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owners, drivers, and shippers with can_carry can register trucks."""
    can_register = current_user.role in (UserRole.owner, UserRole.driver) or (
        current_user.role == UserRole.shipper and current_user.can_carry
    )
    if not can_register:
        raise ForbiddenError()

    # Enforce plan truck quota for fleet owners
    if current_user.role == UserRole.owner:
        plan = await get_effective_plan(current_user.id, db)
        if plan and plan.max_trucks is not None:
            truck_count = (await db.execute(
                select(func.count()).select_from(Truck).where(Truck.owner_id == current_user.id)
            )).scalar() or 0
            if truck_count >= plan.max_trucks:
                raise HTTPException(
                    status_code=402,
                    detail=f"Your {plan.name} plan allows {plan.max_trucks} truck(s). Upgrade your plan to add more.",
                )

        # Require paid onboarding fee for fleet owners
        truck_type_val = payload.truck_type.value if hasattr(payload.truck_type, "value") else str(payload.truck_type)
        fee_kes = ONBOARDING_FEE_KES.get(truck_type_val, 2_000)
        paid_fee = (await db.execute(
            select(OnboardingFeeRecord).where(
                OnboardingFeeRecord.owner_id == current_user.id,
                OnboardingFeeRecord.truck_type == truck_type_val,
                OnboardingFeeRecord.status == OnboardingFeeStatus.paid,
                OnboardingFeeRecord.truck_id == None,  # noqa: E711  not yet consumed
            ).order_by(OnboardingFeeRecord.paid_at.desc()).limit(1)
        )).scalar_one_or_none()

        if not paid_fee:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": f"A one-time platform onboarding fee of KES {fee_kes:,} is required to register this vehicle.",
                    "fee_kes": fee_kes,
                    "truck_type": truck_type_val,
                },
            )

    is_driver_owned = current_user.role == UserRole.driver
    repo = TruckRepository(db)
    truck = await repo.create(owner_id=current_user.id, is_driver_owned=is_driver_owned, **payload.model_dump(exclude={"is_driver_owned"}))

    # Mark the fee record as consumed
    if current_user.role == UserRole.owner:
        paid_fee.truck_id = truck.id
        await db.flush()

    # Kick off automated NTSA plate check (non-blocking)
    background_tasks.add_task(_run_plate_check, truck.id, truck.registration_number)
    await db.commit()
    return truck


@router.get("/public", response_model=list[PublicTruckOut])
async def public_trucks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Truck, User)
        .join(User, Truck.owner_id == User.id)
        .where(Truck.is_active == True, Truck.is_verified == True)
        .order_by(Truck.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()
    return [
        PublicTruckOut(
            id=row.Truck.id,
            registration_number=row.Truck.registration_number,
            truck_type=row.Truck.truck_type,
            capacity_tonnes=row.Truck.capacity_tonnes,
            make=row.Truck.make,
            model=row.Truck.model,
            is_active=row.Truck.is_active,
            owner_name=row.User.full_name,
            owner_rating=row.User.rating,
            owner_trips=row.User.total_trips,
            owner_verified=row.User.is_verified,
            truck_verified=row.Truck.is_verified,
            verification_score=row.Truck.verification_score,
            inspection_status=row.Truck.inspection_status.value if row.Truck.inspection_status else None,
            current_latitude=row.Truck.current_latitude,
            current_longitude=row.Truck.current_longitude,
            last_seen_at=row.Truck.last_seen_at,
        )
        for row in rows
    ]


@router.patch("/{truck_id}/submit-documents", response_model=TruckOut)
async def submit_truck_documents(
    truck_id: uuid.UUID,
    payload: TruckDocumentSubmit,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Owner or driver submits compliance documents for admin review.
    Sets inspection_status to 'submitted'. Works for initial submission
    and resubmission after a rejection.
    """
    if current_user.role not in (UserRole.owner, UserRole.driver):
        raise ForbiddenError()

    repo = TruckRepository(db)
    truck = await repo.get_by_id(truck_id)
    if not truck:
        raise TruckNotFound()
    if truck.owner_id != current_user.id:
        raise ForbiddenError()

    from app.models.truck import InspectionStatus
    updates = payload.model_dump(exclude_none=True)
    updates["inspection_status"] = InspectionStatus.submitted
    updated = await repo.update(truck, **updates)
    # Re-run plate check on every document submission (plate may have been corrected)
    background_tasks.add_task(_run_plate_check, truck.id, truck.registration_number)
    return updated


@router.get("/assigned-to-me", response_model=TruckOut | None)
async def get_assigned_truck(
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    """Returns the truck a driver is currently assigned to by a fleet owner."""
    driver_repo = DriverRepository(db)
    driver = await driver_repo.get_by_user_id(current_user.id)
    if not driver:
        return None

    truck_repo = TruckRepository(db)
    truck = await truck_repo.get_by_assigned_driver(driver.id)
    return truck


@router.get("/nearby", response_model=list[NearbyTruckOut])
async def nearby_trucks(
    lat: float = Query(..., description="Pickup latitude"),
    lon: float = Query(..., description="Pickup longitude"),
    radius_km: float = Query(150.0, description="Search radius in km"),
    truck_type: str | None = Query(None, description="Required truck type"),
    weight_tonnes: float | None = Query(None, description="Minimum capacity needed"),
    limit: int = Query(10, le=20),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return GPS-ranked available trucks near the given pickup coordinates."""
    import math
    from app.models.user import User as UserModel
    from app.services.matching_service import _haversine_km, CarrierCandidate, rank_carriers

    truck_repo = TruckRepository(db)
    trucks = await truck_repo.list_available()

    # Filter by location and optional criteria
    candidates_with_dist: list[tuple[Truck, float]] = []
    for truck in trucks:
        if truck.current_latitude is None or truck.current_longitude is None:
            continue
        dist = _haversine_km(lat, lon, truck.current_latitude, truck.current_longitude)
        if dist > radius_km:
            continue
        if truck_type and truck.truck_type.value != truck_type:
            continue
        if weight_tonnes and truck.capacity_tonnes < weight_tonnes:
            continue
        candidates_with_dist.append((truck, dist))

    if not candidates_with_dist:
        return []

    carrier_candidates = [
        CarrierCandidate(
            user_id=str(t.owner_id),
            truck_id=str(t.id),
            truck_type=t.truck_type.value if hasattr(t.truck_type, "value") else str(t.truck_type),
            capacity_tonnes=float(t.capacity_tonnes),
            current_lat=t.current_latitude,
            current_lon=t.current_longitude,
        )
        for t, _ in candidates_with_dist[:limit * 2]  # over-fetch for ranking
    ]

    scored = rank_carriers(
        candidates=carrier_candidates,
        pickup_lat=lat,
        pickup_lon=lon,
        required_truck_type=truck_type,
        weight_tonnes=float(weight_tonnes or 1.0),
        top_n=limit,
    )

    # Batch-load owner users
    owner_ids = [uuid.UUID(sc.carrier.user_id) for sc in scored]
    owner_rows = (await db.execute(select(UserModel).where(UserModel.id.in_(owner_ids)))).scalars().all()
    owner_map = {str(o.id): o for o in owner_rows}

    result = []
    for sc in scored:
        truck_obj = next((t for t, _ in candidates_with_dist if str(t.id) == sc.carrier.truck_id), None)
        if not truck_obj:
            continue
        owner = owner_map.get(sc.carrier.user_id)
        dist_km = _haversine_km(lat, lon, truck_obj.current_latitude, truck_obj.current_longitude)
        result.append(NearbyTruckOut(
            truck_id=truck_obj.id,
            owner_id=truck_obj.owner_id,
            owner_name=owner.full_name if owner else None,
            owner_rating=float(owner.rating) if owner and owner.rating else 0.0,
            owner_total_trips=owner.total_trips if owner else 0,
            truck_type=sc.carrier.truck_type,
            capacity_tonnes=sc.carrier.capacity_tonnes,
            make=truck_obj.make,
            model=truck_obj.model,
            current_latitude=truck_obj.current_latitude,
            current_longitude=truck_obj.current_longitude,
            distance_km=round(dist_km, 1),
            score=round(sc.score, 2),
        ))
    return result


@router.get("/onboarding-fee")
async def get_onboarding_fee(
    truck_type: str = Query(..., description="Truck type enum value"),
    _: User = Depends(get_current_user),
):
    """Return the one-time platform onboarding fee for a given truck type."""
    fee_kes = ONBOARDING_FEE_KES.get(truck_type, 2_000)
    return {"truck_type": truck_type, "fee_kes": fee_kes}


@router.post("/onboarding-payment/initiate")
async def initiate_onboarding_payment(
    payload: dict,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """
    Create an IntaSend checkout link for the vehicle onboarding fee.
    Returns { payment_url, tx_ref, fee_kes }.
    """
    truck_type = str(payload.get("truck_type", ""))
    if not truck_type or truck_type not in ONBOARDING_FEE_KES:
        raise HTTPException(status_code=400, detail="Invalid or missing truck_type")

    fee_kes = ONBOARDING_FEE_KES[truck_type]

    if not settings.intasend_secret_key:
        raise HTTPException(status_code=503, detail="Payment provider not configured")

    tx_ref = f"onboarding-{current_user.id}-{uuid.uuid4()}"
    redirect_url = settings.intasend_redirect_url or (
        settings.cors_origins_list[0] if settings.cors_origins_list else "http://localhost:5173"
    )
    name_parts = (current_user.full_name or "").split(" ", 1)

    checkout_payload = {
        "public_key": settings.intasend_public_key,
        "currency": "KES",
        "amount": str(fee_kes),
        "email": current_user.email,
        "first_name": name_parts[0] if name_parts else "",
        "last_name": name_parts[1] if len(name_parts) > 1 else "",
        "api_ref": tx_ref,
        "redirect_url": redirect_url,
        "comment": f"Trakvora vehicle onboarding — {truck_type}",
    }
    if settings.intasend_webhook_url:
        checkout_payload["webhook_url"] = settings.intasend_webhook_url

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{settings.intasend_base_url}/api/v1/checkout/",
                json=checkout_payload,
                headers={
                    "Authorization": f"Token {settings.intasend_secret_key}",
                    "Content-Type": "application/json",
                },
            )
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Payment provider request failed: {exc}") from exc

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=(data.get("detail") or data.get("message") or "Unable to create payment session"),
        )

    payment_url = data.get("url")
    if not payment_url:
        raise HTTPException(status_code=502, detail="Payment provider did not return a payment link")

    fee_record = OnboardingFeeRecord(
        owner_id=current_user.id,
        truck_type=truck_type,
        amount_kes=fee_kes,
        status=OnboardingFeeStatus.pending,
        tx_ref=tx_ref,
    )
    db.add(fee_record)
    await db.commit()

    return {"payment_url": payment_url, "tx_ref": tx_ref, "fee_kes": fee_kes}


@router.get("/onboarding-fee/status")
async def get_onboarding_fee_status(
    truck_type: str = Query(...),
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Check if the owner has a paid (unconsumed) onboarding fee for this truck type."""
    paid = (await db.execute(
        select(OnboardingFeeRecord).where(
            OnboardingFeeRecord.owner_id == current_user.id,
            OnboardingFeeRecord.truck_type == truck_type,
            OnboardingFeeRecord.status == OnboardingFeeStatus.paid,
            OnboardingFeeRecord.truck_id == None,  # noqa: E711
        ).limit(1)
    )).scalar_one_or_none()
    return {"truck_type": truck_type, "fee_paid": paid is not None}


@router.get("/{truck_id}", response_model=TruckOut)
async def get_truck(
    truck_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = TruckRepository(db)
    truck = await repo.get_by_id(truck_id)
    if not truck:
        raise TruckNotFound()
    return truck


@router.patch("/{truck_id}", response_model=TruckOut)
async def update_truck(
    truck_id: uuid.UUID,
    payload: TruckUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.owner, UserRole.driver):
        raise ForbiddenError()
    repo = TruckRepository(db)
    truck = await repo.get_by_id(truck_id)
    if not truck:
        raise TruckNotFound()
    if truck.owner_id != current_user.id:
        raise ForbiddenError()
    updated = await repo.update(truck, **payload.model_dump(exclude_none=True))
    return updated


@router.patch("/{truck_id}/assign-driver", response_model=TruckOut)
async def assign_driver_to_truck(
    truck_id: uuid.UUID,
    payload: AssignDriverRequest,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """
    Owner assigns (or unassigns) a driver to a specific truck.
    Sets truck.assigned_driver_id and syncs driver.current_truck_id + driver.employer_id.
    """
    truck_repo = TruckRepository(db)
    driver_repo = DriverRepository(db)

    truck = await truck_repo.get_by_id(truck_id)
    if not truck:
        raise TruckNotFound()
    if truck.owner_id != current_user.id:
        raise ForbiddenError()

    # Unassign the driver currently on this truck (if any) — only clears truck assignment, not employment
    if truck.assigned_driver_id:
        prev_driver = await driver_repo.get_by_id(truck.assigned_driver_id)
        if prev_driver:
            await driver_repo.update(prev_driver, current_truck_id=None)

    if payload.driver_user_id is None:
        # Unassign only
        updated = await truck_repo.update(truck, assigned_driver_id=None)
    else:
        new_driver = await driver_repo.get_by_user_id(payload.driver_user_id)
        if not new_driver:
            raise NotFoundError("Driver profile")

        # Driver must be under this owner's employment (or unaffiliated)
        if new_driver.employer_id and new_driver.employer_id != current_user.id:
            raise ForbiddenError("This driver is employed by another fleet owner")

        # Driver must be verified before assignment
        if new_driver.verification_status != VerificationStatus.approved:
            raise ForbiddenError("Only verified drivers can be assigned to trucks")

        # If driver is already on a different truck, unassign them from it first (reassign)
        if new_driver.current_truck_id and new_driver.current_truck_id != truck.id:
            prev_truck = await truck_repo.get_by_id(new_driver.current_truck_id)
            if prev_truck:
                await truck_repo.update(prev_truck, assigned_driver_id=None)

        await driver_repo.update(
            new_driver,
            current_truck_id=truck.id,
            employer_id=current_user.id,
            seeking_employment=False,
        )
        updated = await truck_repo.update(truck, assigned_driver_id=new_driver.id)

    return updated


@router.post("/{truck_id}/provision-tracker", response_model=dict)
async def provision_tracker(
    truck_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate (or rotate) the tracker_secret for a truck.
    The plaintext secret is returned ONCE — store it immediately.
    Allowed: truck owner OR admin.
    """
    repo = TruckRepository(db)
    truck = await repo.get_by_id(truck_id)
    if not truck:
        raise TruckNotFound()

    # Owners can only provision their own trucks; admins can provision any
    if current_user.role != UserRole.admin and truck.owner_id != current_user.id:
        raise ForbiddenError()

    new_secret = secrets.token_hex(32)          # 64-char hex string
    await repo.update(truck, tracker_secret=new_secret)
    await db.commit()

    return {
        "truck_id":    str(truck.id),
        "tracker_id":  truck.gps_tracker_id,
        "secret":      new_secret,
        "note": (
            "Copy this secret now — it will never be shown again. "
            "Program it into your GPS device as X-Device-Secret."
        ),
    }
