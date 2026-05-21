import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consignment_note import ConsignmentNote
from app.models.shipment import Shipment


class ShipmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, shipment_id: uuid.UUID) -> Shipment | None:
        result = await self.db.execute(select(Shipment).where(Shipment.id == shipment_id))
        return result.scalar_one_or_none()

    async def get_by_load(self, load_id: uuid.UUID) -> Shipment | None:
        result = await self.db.execute(select(Shipment).where(Shipment.load_id == load_id))
        return result.scalar_one_or_none()

    async def list_by_driver(self, driver_id: uuid.UUID) -> list[Shipment]:
        result = await self.db.execute(
            select(Shipment).where(Shipment.driver_id == driver_id).order_by(Shipment.created_at.desc())
        )
        return result.scalars().all()

    async def get_active_by_driver(self, driver_id: uuid.UUID) -> Shipment | None:
        from app.models.load import LoadStatus
        active = [LoadStatus.booked, LoadStatus.en_route_pickup, LoadStatus.loaded, LoadStatus.in_transit]
        result = await self.db.execute(
            select(Shipment)
            .where(Shipment.driver_id == driver_id, Shipment.status.in_(active))
            .order_by(Shipment.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_active_by_owner(self, owner_id: uuid.UUID) -> list[Shipment]:
        from app.models.load import LoadStatus
        active = [LoadStatus.booked, LoadStatus.en_route_pickup, LoadStatus.loaded, LoadStatus.in_transit]
        result = await self.db.execute(
            select(Shipment)
            .where(Shipment.owner_id == owner_id, Shipment.status.in_(active))
            .order_by(Shipment.created_at.desc())
        )
        return result.scalars().all()

    async def list_by_owner(self, owner_id: uuid.UUID) -> list[Shipment]:
        result = await self.db.execute(
            select(Shipment).where(Shipment.owner_id == owner_id).order_by(Shipment.created_at.desc())
        )
        return result.scalars().all()

    async def list_by_shipper(self, shipper_id: uuid.UUID) -> list[Shipment]:
        result = await self.db.execute(
            select(Shipment)
            .join(Shipment.load)
            .where(Shipment.load.has(shipper_id=shipper_id))
            .order_by(Shipment.created_at.desc())
        )
        return result.scalars().all()

    async def create(self, **kwargs) -> Shipment:
        shipment = Shipment(**kwargs)
        self.db.add(shipment)
        await self.db.flush()
        await self.db.refresh(shipment)
        return shipment

    async def update(self, shipment: Shipment, **kwargs) -> Shipment:
        for key, value in kwargs.items():
            setattr(shipment, key, value)
        await self.db.flush()
        await self.db.refresh(shipment)
        return shipment

    async def get_consignment_note(self, shipment_id: uuid.UUID) -> ConsignmentNote | None:
        result = await self.db.execute(
            select(ConsignmentNote).where(ConsignmentNote.shipment_id == shipment_id)
        )
        return result.scalar_one_or_none()

    async def create_consignment_note(self, **kwargs) -> ConsignmentNote:
        note = ConsignmentNote(**kwargs)
        self.db.add(note)
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def update_consignment_note(self, note: ConsignmentNote, **kwargs) -> ConsignmentNote:
        for key, value in kwargs.items():
            setattr(note, key, value)
        await self.db.flush()
        await self.db.refresh(note)
        return note
