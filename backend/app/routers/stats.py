import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.company import Company
from app.models.driver import AvailabilityStatus, Driver
from app.models.load import Load, LoadStatus
from app.models.shipment import Shipment
from app.models.truck import Truck
from app.models.user import User, UserRole

router = APIRouter(tags=["stats"])


@router.get("/stats")
async def public_stats(db: AsyncSession = Depends(get_db)):
    """Platform-wide stats — no authentication required."""

    active_loads = await db.scalar(
        select(func.count()).select_from(Load).where(
            Load.status.in_([LoadStatus.available, LoadStatus.bidding])
        )
    )
    active_drivers = await db.scalar(
        select(func.count()).select_from(Driver).where(
            Driver.availability_status == AvailabilityStatus.available
        )
    )
    active_shipments = await db.scalar(
        select(func.count()).select_from(Shipment).where(
            Shipment.status.in_(["en_route_pickup", "loaded", "in_transit"])
        )
    )
    completed_shipments = await db.scalar(
        select(func.count()).select_from(Shipment).where(
            Shipment.status == "delivered"
        )
    )
    total_carriers = await db.scalar(
        select(func.count()).select_from(User).where(
            User.role.in_([UserRole.driver, UserRole.owner])
        )
    )
    total_trucks = await db.scalar(
        select(func.count()).select_from(Truck).where(Truck.is_active == True)  # noqa: E712
    )
    corridors = await db.scalar(
        select(func.count(func.distinct(Load.corridor))).select_from(Load).where(
            Load.corridor.isnot(None)
        )
    )

    return {
        "active_loads": active_loads or 0,
        "active_drivers": active_drivers or 0,
        "active_shipments": active_shipments or 0,
        "completed_shipments": completed_shipments or 0,
        "total_carriers": total_carriers or 0,
        "total_trucks": total_trucks or 0,
        "corridors_served": corridors or 0,
    }


class FeaturedCompanyOut(BaseModel):
    id: uuid.UUID
    name: str
    logo_url: str | None

    model_config = {"from_attributes": True}


@router.get("/landing/featured-companies", response_model=list[FeaturedCompanyOut])
async def featured_companies(db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns companies flagged as featured for the landing page."""
    result = await db.execute(
        select(Company).where(Company.is_featured == True).order_by(Company.name)  # noqa: E712
    )
    return result.scalars().all()
