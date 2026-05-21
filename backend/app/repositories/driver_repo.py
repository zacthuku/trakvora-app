import uuid
from typing import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.driver import AvailabilityStatus, Driver


class DriverRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_id(self, user_id: uuid.UUID) -> Driver | None:
        result = await self.db.execute(select(Driver).where(Driver.user_id == user_id))
        return result.scalar_one_or_none()

    async def get_by_id(self, driver_id: uuid.UUID) -> Driver | None:
        result = await self.db.execute(select(Driver).where(Driver.id == driver_id))
        return result.scalar_one_or_none()

    async def list_available(self) -> Sequence[Driver]:
        """Return drivers who are available or actively seeking employment."""
        result = await self.db.execute(
            select(Driver).where(
                or_(
                    Driver.availability_status == AvailabilityStatus.available,
                    Driver.seeking_employment == True,  # noqa: E712
                )
            )
        )
        return result.scalars().all()

    async def list_by_employer(self, employer_user_id: uuid.UUID) -> Sequence[Driver]:
        result = await self.db.execute(
            select(Driver).where(Driver.employer_id == employer_user_id)
        )
        return result.scalars().all()

    async def create(self, **kwargs) -> Driver:
        driver = Driver(**kwargs)
        self.db.add(driver)
        await self.db.flush()
        await self.db.refresh(driver)
        return driver

    async def update(self, driver: Driver, **kwargs) -> Driver:
        for key, value in kwargs.items():
            setattr(driver, key, value)
        await self.db.flush()
        await self.db.refresh(driver)
        return driver
