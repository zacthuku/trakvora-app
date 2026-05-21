import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.driver import AvailabilityStatus, Driver
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
from app.services import notification_service


class InviteResponsePayload(BaseModel):
    owner_id:        uuid.UUID
    notification_id: uuid.UUID


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
            or_(
                Driver.availability_status == AvailabilityStatus.available,
                Driver.seeking_employment == True,  # noqa: E712
            )
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
    """Drivers who are available or actively seeking employment."""
    result = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .where(
            or_(
                Driver.availability_status == AvailabilityStatus.available,
                Driver.seeking_employment == True,  # noqa: E712
            )
        )
    )
    return [_driver_with_user(d) for d in result.scalars().all()]


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
    from app.models.subscription import Subscription, SubscriptionStatus
    sub_result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]),
        )
    )
    sub = sub_result.scalar_one_or_none()
    if sub and sub.plan and sub.plan.max_drivers is not None:
        count_result = await db.execute(
            select(func.count()).select_from(Driver).where(Driver.employer_id == current_user.id)
        )
        driver_count = count_result.scalar() or 0
        if driver_count >= sub.plan.max_drivers:
            raise HTTPException(
                status_code=402,
                detail=f"Your {sub.plan.name} plan allows {sub.plan.max_drivers} driver(s). Upgrade your plan to add more.",
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
