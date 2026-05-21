import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, NotFoundError, TruckNotFound
from app.models.driver import VerificationStatus
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.truck import Truck
from app.models.user import User, UserRole
from app.repositories.driver_repo import DriverRepository
from app.repositories.truck_repo import TruckRepository
from app.schemas.driver import AssignDriverRequest
from app.schemas.truck import TruckCreate, TruckOut, TruckUpdate, PublicTruckOut

router = APIRouter(tags=["trucks"])


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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owners and drivers can register trucks. Driver-created trucks set is_driver_owned=True."""
    if current_user.role not in (UserRole.owner, UserRole.driver):
        raise ForbiddenError()

    # Enforce plan truck quota for fleet owners
    if current_user.role == UserRole.owner:
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
        if sub and sub.plan and sub.plan.max_trucks is not None:
            count_result = await db.execute(
                select(func.count()).select_from(Truck).where(Truck.owner_id == current_user.id)
            )
            truck_count = count_result.scalar() or 0
            if truck_count >= sub.plan.max_trucks:
                raise HTTPException(
                    status_code=402,
                    detail=f"Your {sub.plan.name} plan allows {sub.plan.max_trucks} truck(s). Upgrade your plan to add more.",
                )

    is_driver_owned = current_user.role == UserRole.driver
    data = payload.model_dump()
    data["is_driver_owned"] = is_driver_owned
    data.pop("is_driver_owned", None)  # use computed value
    repo = TruckRepository(db)
    truck = await repo.create(owner_id=current_user.id, is_driver_owned=is_driver_owned, **payload.model_dump(exclude={"is_driver_owned"}))
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
        .where(Truck.is_active == True)
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
        )
        for row in rows
    ]


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
