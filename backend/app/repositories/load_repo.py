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
        truck_type: str | None = None,
        urgent: bool | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        sort: str | None = None,
        page: int = 1,
        page_size: int = 20,
        carrier_user_id: uuid.UUID | None = None,
    ) -> tuple[list[Load], int]:
        from app.models.load import LoadVisibility
        from app.models.preferred_carrier import CompanyPreferredCarrier
        from app.models.company import CompanyMember
        from sqlalchemy import or_, exists

        q = select(Load).where(Load.status == LoadStatus.available)

        # Visibility filter: carrier sees public loads + preferred_only loads where they're in the shipper's company preferred list
        if carrier_user_id is not None:
            preferred_subq = (
                select(CompanyPreferredCarrier.company_id)
                .join(CompanyMember, CompanyMember.company_id == CompanyPreferredCarrier.company_id)
                .where(
                    CompanyPreferredCarrier.carrier_user_id == carrier_user_id,
                    CompanyMember.user_id == Load.shipper_id,
                    CompanyMember.is_active == True,
                )
                .correlate(Load)
                .exists()
            )
            q = q.where(
                or_(
                    Load.visibility == LoadVisibility.public,
                    preferred_subq,
                )
            )
        else:
            q = q.where(Load.visibility == LoadVisibility.public)
        if cargo_type:
            q = q.where(Load.cargo_type == cargo_type)
        if corridor:
            q = q.where(Load.corridor == corridor)
        if truck_type:
            q = q.where(Load.required_truck_type == truck_type)
        if urgent is True:
            q = q.where(Load.is_urgent == True)
        if min_price is not None:
            q = q.where(Load.price_kes >= min_price)
        if max_price is not None:
            q = q.where(Load.price_kes <= max_price)

        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()

        if sort == "price_asc":
            q = q.order_by(Load.price_kes.asc())
        elif sort == "price_desc":
            q = q.order_by(Load.price_kes.desc())
        elif sort == "urgent":
            q = q.order_by(Load.is_urgent.desc(), Load.created_at.desc())
        else:
            q = q.order_by(Load.created_at.desc())

        q = q.offset((page - 1) * page_size).limit(page_size).options(selectinload(Load.shipper))
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
        from app.models.load_carrier_offer import LoadCarrierOffer, CarrierOfferStatus

        # Legacy single-FK offers
        legacy_result = await self.db.execute(
            select(Load)
            .where(Load.direct_offer_user_id == user_id, Load.status == LoadStatus.available)
            .order_by(Load.created_at.desc())
            .options(selectinload(Load.shipper))
        )
        loads = list(legacy_result.scalars().all())
        seen_ids = {l.id for l in loads}

        # Blast junction-table offers (pending only)
        blast_result = await self.db.execute(
            select(Load)
            .join(LoadCarrierOffer, LoadCarrierOffer.load_id == Load.id)
            .where(
                LoadCarrierOffer.user_id == user_id,
                LoadCarrierOffer.status == CarrierOfferStatus.pending,
                Load.status == LoadStatus.available,
            )
            .order_by(Load.created_at.desc())
            .options(selectinload(Load.shipper))
        )
        for load in blast_result.scalars().all():
            if load.id not in seen_ids:
                loads.append(load)
                seen_ids.add(load.id)

        return loads

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
