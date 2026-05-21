"""
Provider profile router — serves mover, air_freight, and parcel_carrier roles.
All endpoints require the current user to be one of the three provider role types.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.airfreight import Airfreight
from app.models.move_request import MoveRequest
from app.models.parcel import Parcel
from app.models.provider_profile import AirFreightProfile, MoverProfile, ParcelCarrierProfile
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.services import notification_service

router = APIRouter(prefix="/provider", tags=["provider"])

PROVIDER_ROLES = {UserRole.mover, UserRole.air_freight, UserRole.parcel_carrier}


def _require_provider(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in PROVIDER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider role required")
    return current_user


async def _get_profile(user: User, db: AsyncSession):
    if user.role == UserRole.mover:
        return (await db.execute(select(MoverProfile).where(MoverProfile.user_id == user.id))).scalar_one_or_none()
    if user.role == UserRole.air_freight:
        return (await db.execute(select(AirFreightProfile).where(AirFreightProfile.user_id == user.id))).scalar_one_or_none()
    return (await db.execute(select(ParcelCarrierProfile).where(ParcelCarrierProfile.user_id == user.id))).scalar_one_or_none()


def _profile_to_dict(profile) -> dict:
    cols = {c.name for c in profile.__table__.columns}
    return {c: getattr(profile, c) for c in cols}


# ── Profile endpoints ────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(
    current_user: User = Depends(_require_provider),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await _get_profile(current_user, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = _profile_to_dict(profile)
    data["company_name"] = current_user.company_name
    data["full_name"]    = current_user.full_name
    data["email"]        = current_user.email
    data["role"]         = current_user.role.value
    return data


class ProfileUpdate(BaseModel):
    bio:                       str | None = None
    service_areas:             list[str] | None = None
    license_number:            str | None = None
    insurance_number:          str | None = None
    min_price_kes:             float | None = None
    # Mover-specific
    fleet_size:                int | None = None
    services_offered:          list[str] | None = None
    # Airfreight-specific
    iata_agent_code:           str | None = None
    supported_routes:          list[dict] | None = None
    supported_airlines:        list[str] | None = None
    has_warehousing:           bool | None = None
    has_customs_clearance:     bool | None = None
    dangerous_goods_certified: bool | None = None
    min_weight_kg:             float | None = None
    max_weight_kg:             float | None = None
    # Parcel carrier-specific
    service_levels:            list[str] | None = None
    max_weight_kg:             float | None = None  # type: ignore[assignment]
    has_cod:                   bool | None = None


@router.patch("/profile")
async def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(_require_provider),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await _get_profile(current_user, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for field, value in body.model_dump(exclude_none=True).items():
        if hasattr(profile, field):
            setattr(profile, field, value)
    await db.commit()
    return _profile_to_dict(profile)


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    current_user: User = Depends(_require_provider),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await _get_profile(current_user, db)
    pending_count = await _count_available(current_user, db)
    return {
        "total_jobs":   profile.total_jobs if profile else 0,
        "rating":       profile.rating if profile else None,
        "is_verified":  profile.is_verified if profile else False,
        "pending_available": pending_count,
    }


async def _count_available(user: User, db: AsyncSession) -> int:
    if user.role == UserRole.mover:
        q = select(MoveRequest).where(MoveRequest.provider_id.is_(None), MoveRequest.status == "pending")
    elif user.role == UserRole.air_freight:
        q = select(Airfreight).where(Airfreight.provider_id.is_(None), Airfreight.status == "pending")
    else:
        q = select(Parcel).where(Parcel.carrier_id.is_(None), Parcel.status == "pending")
    result = await db.execute(q)
    return len(result.scalars().all())


# ── Available bookings marketplace ───────────────────────────────────────────

@router.get("/bookings/available")
async def get_available_bookings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(_require_provider),
    db: AsyncSession = Depends(get_db),
) -> dict:
    offset = (page - 1) * page_size

    if current_user.role == UserRole.mover:
        q = select(MoveRequest).where(MoveRequest.provider_id.is_(None), MoveRequest.status == "pending")
    elif current_user.role == UserRole.air_freight:
        q = select(Airfreight).where(Airfreight.provider_id.is_(None), Airfreight.status == "pending")
    else:
        q = select(Parcel).where(Parcel.carrier_id.is_(None), Parcel.status == "pending")

    total_result = await db.execute(q)
    total = len(total_result.scalars().all())

    q = q.order_by(q.froms[0].c.created_at.desc()).offset(offset).limit(page_size)
    items = (await db.execute(q)).scalars().all()

    return {
        "items": [_booking_to_dict(b) for b in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _booking_to_dict(booking) -> dict:
    cols = {c.name for c in booking.__table__.columns}
    d = {}
    for c in cols:
        val = getattr(booking, c)
        if hasattr(val, "isoformat"):
            val = val.isoformat()
        elif hasattr(val, "__str__") and "UUID" in type(val).__name__:
            val = str(val)
        d[c] = val
    return d


@router.post("/bookings/{booking_id}/accept", status_code=200)
async def accept_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(_require_provider),
    db: AsyncSession = Depends(get_db),
) -> dict:
    now = datetime.now(timezone.utc)

    if current_user.role == UserRole.mover:
        booking = (await db.execute(select(MoveRequest).where(MoveRequest.id == booking_id))).scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.provider_id is not None:
            raise HTTPException(status_code=409, detail="Booking already accepted by another provider")
        booking.provider_id = current_user.id
        booking.accepted_at = now
        booking.status = "accepted"
        shipper_id = booking.shipper_id
        booking_label = f"move request ({booking.move_type})"

    elif current_user.role == UserRole.air_freight:
        booking = (await db.execute(select(Airfreight).where(Airfreight.id == booking_id))).scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.provider_id is not None:
            raise HTTPException(status_code=409, detail="Booking already accepted by another provider")
        booking.provider_id = current_user.id
        booking.accepted_at = now
        booking.status = "accepted"
        shipper_id = booking.shipper_id
        booking_label = f"airfreight ({booking.port_of_origin} → {booking.port_of_destination})"

    else:
        booking = (await db.execute(select(Parcel).where(Parcel.id == booking_id))).scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.carrier_id is not None:
            raise HTTPException(status_code=409, detail="Booking already accepted by another carrier")
        booking.carrier_id = current_user.id
        booking.accepted_at = now
        booking.status = "accepted"
        shipper_id = booking.shipper_id
        booking_label = f"parcel ({booking.pickup_location} → {booking.dropoff_location})"

    # Increment provider's total_jobs
    profile = await _get_profile(current_user, db)
    if profile:
        profile.total_jobs = (profile.total_jobs or 0) + 1

    # Notify the shipper
    await notification_service.send_notification(
        user_id=shipper_id,
        notification_type=NotificationType.system,
        title="Booking Accepted",
        body=f"{current_user.company_name or current_user.full_name} has accepted your {booking_label}.",
        reference_id=booking_id,
        reference_type="booking",
        db=db,
    )

    await db.commit()
    return {"booking_id": str(booking_id), "status": "accepted"}


# ── My jobs (accepted/active/completed) ──────────────────────────────────────

@router.get("/jobs")
async def get_my_jobs(
    job_status: str | None = Query(None, description="Filter by status: accepted, in_progress, completed, cancelled"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(_require_provider),
    db: AsyncSession = Depends(get_db),
) -> dict:
    offset = (page - 1) * page_size

    if current_user.role == UserRole.mover:
        q = select(MoveRequest).where(MoveRequest.provider_id == current_user.id)
    elif current_user.role == UserRole.air_freight:
        q = select(Airfreight).where(Airfreight.provider_id == current_user.id)
    else:
        q = select(Parcel).where(Parcel.carrier_id == current_user.id)

    if job_status:
        q = q.where(q.froms[0].c.status == job_status)

    total_result = await db.execute(q)
    total = len(total_result.scalars().all())

    q = q.order_by(q.froms[0].c.created_at.desc()).offset(offset).limit(page_size)
    items = (await db.execute(q)).scalars().all()

    return {
        "items": [_booking_to_dict(b) for b in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
