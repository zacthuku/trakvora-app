import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.core.subscription_limits import get_effective_plan
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.core.exceptions import ForbiddenError
from app.models.driver import AvailabilityStatus, Driver, VerificationStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.repositories.driver_repo import DriverRepository
from app.repositories.message_repo import MessageRepository
from app.repositories.notification_repo import NotificationRepository
from app.repositories.user_repo import UserRepository
from app.schemas.driver import (
    DriverAvailabilityUpdate, DriverOut, DriverProfileCreate,
    DriverProfileUpdate, DriverPublicOut, DriverWithUserOut, JobPostCreate,
)
from app.services import email_service, notification_service
from app.services.kyc_service import verify_driver_licence


class InviteResponsePayload(BaseModel):
    owner_id:        uuid.UUID
    notification_id: uuid.UUID


class RegisterDriverForOwnerPayload(BaseModel):
    full_name:    str       = Field(..., min_length=2, max_length=255)
    email:        EmailStr
    phone:        str       = Field(..., min_length=8, max_length=25)
    country:      str       = Field(default="KE", max_length=2)
    licence_number: str     = Field(..., min_length=2, max_length=50)
    national_id:  str | None = None
    kra_pin:      str | None = None


def _driver_with_user(d: Driver) -> DriverWithUserOut:
    u = d.user
    return DriverWithUserOut(
        id=d.id, user_id=d.user_id, employer_id=d.employer_id,
        licence_class=d.licence_class, licence_expiry=d.licence_expiry,
        verification_status=d.verification_status, ntsa_verified=d.ntsa_verified,
        bio=d.bio, experience_years=d.experience_years,
        preferred_routes=d.preferred_routes, preferred_truck_types=d.preferred_truck_types,
        availability_status=d.availability_status, availability_location=d.availability_location,
        available_from=d.available_from, seeking_employment=d.seeking_employment,
        current_truck_id=d.current_truck_id, created_at=d.created_at,
        full_name=u.full_name if u else None,
        email=u.email if u else None,
        profile_photo_url=u.profile_photo_url if u else None,
        rating=u.rating if u else None,
        total_trips=u.total_trips if u else 0,
    )

router = APIRouter(tags=["drivers"])


# ── Driver: accept / decline employment invitations ─────────────────────────

@router.post("/invite/accept")
async def accept_invite(
    payload: InviteResponsePayload,
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    """Driver accepts an employment invitation from an owner."""
    driver_repo = DriverRepository(db)
    user_repo   = UserRepository(db)
    notif_repo  = NotificationRepository(db)
    msg_repo    = MessageRepository(db)

    driver = await driver_repo.get_by_user_id(current_user.id)
    if not driver:
        raise NotFoundError("Driver profile")

    owner = await user_repo.get_by_id(payload.owner_id)
    if not owner:
        raise NotFoundError("Owner")

    await driver_repo.update(driver, employer_id=payload.owner_id)
    await notif_repo.mark_read(payload.notification_id, current_user.id)

    await notification_service.send_notification(
        user_id=payload.owner_id,
        notification_type=NotificationType.system,
        title="Invite Accepted",
        body=f"{current_user.full_name} has accepted your employment invitation and joined your team.",
        reference_id=current_user.id,
        reference_type="invite_accepted",
        db=db,
    )

    contact_body = (
        f"Driver {current_user.full_name} has accepted your invitation and joined your team.\n\n"
        f"Contact Details:\n"
        f"  Name:  {current_user.full_name}\n"
        f"  Phone: {current_user.phone or 'Not provided'}\n"
        f"  Email: {current_user.email}\n\n"
        f"You can now assign them to a truck via Fleet Management."
    )
    await msg_repo.create(
        sender_id=current_user.id,
        recipient_id=payload.owner_id,
        subject=f"New Team Member: {current_user.full_name}",
        body=contact_body,
        message_type="invite_accepted",
    )

    return {"status": "accepted"}


@router.post("/invite/decline")
async def decline_invite(
    payload: InviteResponsePayload,
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    """Driver declines an employment invitation from an owner."""
    user_repo  = UserRepository(db)
    notif_repo = NotificationRepository(db)

    owner = await user_repo.get_by_id(payload.owner_id)
    if not owner:
        raise NotFoundError("Owner")

    await notif_repo.mark_read(payload.notification_id, current_user.id)

    await notification_service.send_notification(
        user_id=payload.owner_id,
        notification_type=NotificationType.system,
        title="Invite Declined",
        body=f"{current_user.full_name} has declined your employment invitation.",
        reference_id=current_user.id,
        reference_type="invite_declined",
        db=db,
    )

    return {"status": "declined"}


@router.get("/me", response_model=DriverOut)
async def get_my_profile(
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    repo = DriverRepository(db)
    driver = await repo.get_by_user_id(current_user.id)
    if not driver:
        driver = await repo.create(user_id=current_user.id, licence_number="PENDING")
    return driver


@router.post("/me", response_model=DriverOut, status_code=201)
async def create_profile(
    payload: DriverProfileCreate,
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    repo = DriverRepository(db)
    driver = await repo.create(user_id=current_user.id, **payload.model_dump())
    return driver


@router.patch("/me", response_model=DriverOut)
async def update_profile(
    payload: DriverProfileUpdate,
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    repo = DriverRepository(db)
    driver = await repo.get_by_user_id(current_user.id)
    if not driver:
        raise NotFoundError("Driver profile")
    updated = await repo.update(driver, **payload.model_dump(exclude_none=True))
    return updated


@router.post("/register-for-owner", response_model=DriverWithUserOut, status_code=201)
async def register_driver_for_owner(
    payload: RegisterDriverForOwnerPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Fleet owner registers a new driver who is not yet on Trakvora."""
    from app.core.security import hash_password
    from app.repositories.wallet_repo import WalletRepository
    from app.services.auth_service import _assign_free_plan, currency_for_user

    user_repo = UserRepository(db)
    if await user_repo.get_by_email(payload.email):
        raise HTTPException(409, "A user with this email already exists on Trakvora.")

    new_user = await user_repo.create(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        role=UserRole.driver,
        country=payload.country.upper(),
        national_id=payload.national_id,
        kra_pin=payload.kra_pin,
        is_verified=True,
    )

    wallet_repo = WalletRepository(db)
    await wallet_repo.create_wallet(new_user.id, currency=currency_for_user(new_user))
    await _assign_free_plan(new_user, db)

    driver_repo = DriverRepository(db)
    driver = await driver_repo.create(
        user_id=new_user.id,
        licence_number=payload.licence_number,
        employer_id=current_user.id,
    )
    await db.refresh(driver, ["user"])

    owner_name = current_user.full_name or current_user.company_name or "Your employer"
    background_tasks.add_task(
        email_service.send_driver_account_created_email,
        new_user.email, new_user.full_name, owner_name,
    )

    return _driver_with_user(driver)


async def _run_licence_check(driver_id: uuid.UUID, licence_number: str, country: str) -> None:
    """Background task: verify driving licence via Smile Identity and save result."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        repo = DriverRepository(db)
        driver = await repo.get_by_id(driver_id)
        if not driver:
            return
        # Mark as pending while the check runs
        await repo.update(driver, licence_check_status="pending")
        passed, detail = await verify_driver_licence(licence_number, country)
        await repo.update(
            driver,
            licence_check_status="passed" if passed else "failed",
            licence_check_at=datetime.now(timezone.utc),
            licence_check_detail=detail,
        )


@router.patch("/me/submit-documents", response_model=DriverOut)
async def submit_driver_documents(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    """
    Driver declares their documents are ready for admin review.
    Requires licence_photo_url to be already uploaded on the profile.
    Sets documents_submitted=True. Works as initial submission and resubmission after rejection.
    Automatically triggers an NTSA licence check in the background via Smile Identity.
    """
    repo = DriverRepository(db)
    driver = await repo.get_by_user_id(current_user.id)
    if not driver:
        raise NotFoundError("Driver profile")
    if not driver.licence_photo_url:
        raise ForbiddenError("Please upload your licence photo before submitting for review.")
    updated = await repo.update(driver, documents_submitted=True)
    # Kick off automated NTSA licence check (non-blocking)
    country = (current_user.country or "KE").upper()
    background_tasks.add_task(
        _run_licence_check, driver.id, driver.licence_number, country
    )
    return updated


@router.patch("/me/availability", response_model=DriverOut)
async def update_availability(
    payload: DriverAvailabilityUpdate,
    current_user: User = Depends(require_role(UserRole.driver)),
    db: AsyncSession = Depends(get_db),
):
    repo = DriverRepository(db)
    driver = await repo.get_by_user_id(current_user.id)
    if not driver:
        driver = await repo.create(user_id=current_user.id, licence_number="PENDING")
    updated = await repo.update(driver, **payload.model_dump(exclude_none=True))
    return updated


@router.get("/available", response_model=list[DriverPublicOut])
async def list_available_drivers(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List drivers who are available or actively seeking employment."""
    repo = DriverRepository(db)
    drivers = await repo.list_available()
    return drivers


@router.get("/search-carriers", response_model=list[DriverWithUserOut])
async def search_carriers_for_offer(
    q: str | None = Query(None, description="Search by name or location"),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search available drivers that shippers can send direct load offers to."""
    stmt = (
        select(Driver)
        .options(selectinload(Driver.user))
        .where(
            Driver.verification_status == VerificationStatus.approved,
            or_(
                Driver.availability_status == AvailabilityStatus.available,
                Driver.seeking_employment == True,  # noqa: E712
            ),
        )
    )
    result = await db.execute(stmt)
    drivers = result.scalars().all()
    if q:
        q_lower = q.lower()
        drivers = [
            d for d in drivers
            if q_lower in (d.user.full_name or "").lower()
            or q_lower in (d.availability_location or "").lower()
        ]
    return [_driver_with_user(d) for d in drivers]


@router.get("/by-user/{user_id}", response_model=DriverPublicOut)
async def get_driver_by_user(
    user_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get public driver profile by user_id — accessible to any authenticated user."""
    repo = DriverRepository(db)
    driver = await repo.get_by_user_id(user_id)
    if not driver:
        raise NotFoundError("Driver profile")
    return driver


# ── Owner: fleet driver management (must be before /{driver_id}) ────────────


@router.get("/my-team", response_model=list[DriverWithUserOut])
async def get_my_team(
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """All drivers currently employed by this fleet owner."""
    result = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .where(Driver.employer_id == current_user.id)
    )
    return [_driver_with_user(d) for d in result.scalars().all()]


@router.get("/seeking", response_model=list[DriverWithUserOut])
async def get_seeking_drivers(
    _: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Verified drivers who are available or actively seeking employment."""
    result = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .where(
            Driver.verification_status == VerificationStatus.approved,
            or_(
                Driver.availability_status == AvailabilityStatus.available,
                Driver.seeking_employment == True,  # noqa: E712
            ),
        )
    )
    return [_driver_with_user(d) for d in result.scalars().all()]


@router.get("/{driver_id}/stats")
async def get_driver_stats(
    driver_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.models.shipment import Shipment
    from app.models.load import Load, LoadStatus

    repo = DriverRepository(db)
    driver = await repo.get_by_id(driver_id)
    if not driver:
        raise NotFoundError("Driver profile")

    # Only the driver themselves, their employer, or admins can view stats
    is_own = current_user.id == driver.user_id
    is_employer = current_user.id == driver.employer_id
    is_admin = current_user.role == UserRole.admin
    if not (is_own or is_employer or is_admin):
        raise ForbiddenError()

    all_shipments = (await db.execute(
        select(Shipment).where(Shipment.driver_id == driver.user_id)
        .options(selectinload(Shipment.load))
    )).scalars().all()

    total_trips     = len(all_shipments)
    completed       = [s for s in all_shipments if s.status == LoadStatus.delivered]
    cancelled       = [s for s in all_shipments if s.status == LoadStatus.cancelled]
    disputes        = [s for s in all_shipments if s.dispute_open]
    rated           = [s for s in completed if s.carrier_rating is not None]
    avg_rating      = round(sum(s.carrier_rating for s in rated) / len(rated), 2) if rated else None

    from datetime import date as _date
    this_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    trips_this_month = sum(1 for s in all_shipments if s.delivered_at and s.delivered_at >= this_month_start)

    # Corridor breakdown
    corridor_counts: dict[str, int] = {}
    for s in completed:
        if s.load:
            key = f"{s.load.pickup_location} → {s.load.dropoff_location}" if s.load.pickup_location and s.load.dropoff_location else (s.load.corridor or "Unknown")
            corridor_counts[key] = corridor_counts.get(key, 0) + 1
    top_corridors = sorted(
        [{"route": k, "trips": v} for k, v in corridor_counts.items()],
        key=lambda x: x["trips"],
        reverse=True,
    )[:5]

    # Cargo type breakdown
    cargo_counts: dict[str, int] = {}
    for s in all_shipments:
        if s.load and s.load.cargo_type:
            ct = s.load.cargo_type
            cargo_counts[ct] = cargo_counts.get(ct, 0) + 1
    cargo_breakdown = [{"type": k, "trips": v} for k, v in cargo_counts.items()]

    completion_rate = round(len(completed) / total_trips * 100, 1) if total_trips else 0

    return {
        "total_trips":           total_trips,
        "completed_trips":       len(completed),
        "cancelled_trips":       len(cancelled),
        "completion_rate_pct":   completion_rate,
        "trips_this_month":      trips_this_month,
        "avg_rating":            avg_rating,
        "disputes_raised":       len(disputes),
        "top_corridors":         top_corridors,
        "cargo_type_breakdown":  cargo_breakdown,
    }


@router.get("/{driver_id}", response_model=DriverPublicOut)
async def get_driver_by_id(
    driver_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get public driver profile by driver profile UUID."""
    repo = DriverRepository(db)
    driver = await repo.get_by_id(driver_id)
    if not driver:
        raise NotFoundError("Driver profile")
    return driver


@router.delete("/{driver_id}/dismiss", status_code=204)
async def dismiss_driver(
    driver_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Remove a driver from the owner's team (clears employer_id and truck assignment)."""
    repo = DriverRepository(db)
    driver = await repo.get_by_id(driver_id)
    if not driver or driver.employer_id != current_user.id:
        raise HTTPException(404, "Driver not found in your team")
    await repo.update(driver, employer_id=None, current_truck_id=None)


@router.post("/{driver_id}/invite", status_code=204)
async def invite_driver(
    driver_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Send an employment invitation notification to a specific driver."""
    repo = DriverRepository(db)
    driver = await repo.get_by_id(driver_id)
    if not driver:
        raise HTTPException(404, "Driver not found")
    if driver.employer_id:
        raise HTTPException(409, "Driver is already employed")

    # Enforce plan driver quota
    plan = await get_effective_plan(current_user.id, db)
    if plan and plan.max_drivers is not None:
        driver_count = (await db.execute(
            select(func.count()).select_from(Driver).where(Driver.employer_id == current_user.id)
        )).scalar() or 0
        if driver_count >= plan.max_drivers:
            raise HTTPException(
                status_code=402,
                detail=f"Your {plan.name} plan allows {plan.max_drivers} driver(s). Upgrade your plan to add more.",
            )

    await notification_service.send_notification(
        user_id=driver.user_id,
        notification_type=NotificationType.system,
        title="Employment Invitation",
        body=f"{current_user.full_name or 'A fleet owner'} has invited you to join their team. Visit your profile to accept.",
        reference_id=current_user.id,
        reference_type="owner_invite",
        db=db,
    )


@router.post("/job-post", status_code=204)
async def post_job(
    payload: JobPostCreate,
    current_user: User = Depends(require_role(UserRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Broadcast a job opportunity to all drivers currently seeking employment."""
    result = await db.execute(
        select(Driver).where(Driver.seeking_employment == True)  # noqa: E712
    )
    seeking = result.scalars().all()
    body = payload.description
    if payload.location:
        body += f" | Location: {payload.location}"
    if payload.required_truck_type:
        body += f" | Truck: {payload.required_truck_type}"
    if payload.salary_range:
        body += f" | Pay: {payload.salary_range}"
    for driver in seeking:
        await notification_service.send_notification(
            user_id=driver.user_id,
            notification_type=NotificationType.system,
            title=f"Job Opportunity: {payload.title}",
            body=f"Posted by {current_user.full_name or 'Fleet Owner'}. {body}",
            reference_id=current_user.id,
            reference_type="job_post",
            db=db,
        )
