import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.load import Load, LoadStatus
from app.models.shipment import Shipment


class LoadRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, load_id: uuid.UUID) -> Load | None:
        result = await self.db.execute(
            select(Load).where(Load.id == load_id).options(selectinload(Load.shipper))
        )
        return result.scalar_one_or_none()

    async def list_marketplace(
        self,
        cargo_type: str | None = None,
        corridor: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Load], int]:
        q = select(Load).where(Load.status == LoadStatus.available)
        if cargo_type:
            q = q.where(Load.cargo_type == cargo_type)
        if corridor:
            q = q.where(Load.corridor == corridor)
        count_q = select(Load).where(Load.status == LoadStatus.available)
        total_result = await self.db.execute(count_q)
        total = len(total_result.scalars().all())
        q = q.offset((page - 1) * page_size).limit(page_size).order_by(Load.created_at.desc()).options(selectinload(Load.shipper))
        result = await self.db.execute(q)
        return result.scalars().all(), total

    async def list_by_shipper(
        self,
        shipper_id: uuid.UUID,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Load], int]:
        q = select(Load).where(Load.shipper_id == shipper_id)
        if status:
            q = q.where(Load.status == status)
        q = q.order_by(Load.created_at.desc())
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.offset((page - 1) * page_size).limit(page_size).options(selectinload(Load.shipper))
        result = await self.db.execute(q)
        return result.scalars().all(), total

    async def list_by_owner_shipments(
        self,
        owner_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Load], int]:
        q = (
            select(Load)
            .join(Shipment, Shipment.load_id == Load.id)
            .where(Shipment.owner_id == owner_id)
            .order_by(Load.created_at.desc())
            .distinct()
        )
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.offset((page - 1) * page_size).limit(page_size).options(selectinload(Load.shipper))
        result = await self.db.execute(q)
        return result.scalars().all(), total

    async def list_by_driver_shipments(
        self,
        driver_id: uuid.UUID,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[Load], int]:
        active = [
            LoadStatus.booked,
            LoadStatus.en_route_pickup,
            LoadStatus.loaded,
            LoadStatus.in_transit,
        ]
        q = (
            select(Load)
            .join(Shipment, Shipment.load_id == Load.id)
            .where(Shipment.driver_id == driver_id, Load.status.in_(active))
            .distinct()
        )
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.order_by(Load.created_at.desc()).offset((page - 1) * page_size).limit(page_size).options(selectinload(Load.shipper))
        result = await self.db.execute(q)
        return list(result.scalars().all()), total or 0

    async def list_direct_offers_for_user(self, user_id: uuid.UUID) -> list[Load]:
        result = await self.db.execute(
            select(Load)
            .where(Load.direct_offer_user_id == user_id, Load.status == LoadStatus.available)
            .order_by(Load.created_at.desc())
            .options(selectinload(Load.shipper))
        )
        return list(result.scalars().all())

    async def create(self, **kwargs) -> Load:
        load = Load(**kwargs)
        self.db.add(load)
        await self.db.flush()
        await self.db.refresh(load)
        return load

    async def update(self, load: Load, **kwargs) -> Load:
        for key, value in kwargs.items():
            setattr(load, key, value)
        await self.db.flush()
        await self.db.refresh(load)
        return load
