import uuid
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.load_carrier_offer import CarrierOfferStatus, LoadCarrierOffer


class LoadCarrierOfferRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, load_id: uuid.UUID, user_id: uuid.UUID) -> LoadCarrierOffer:
        offer = LoadCarrierOffer(load_id=load_id, user_id=user_id)
        self.db.add(offer)
        await self.db.flush()
        await self.db.refresh(offer)
        return offer

    async def get(self, load_id: uuid.UUID, user_id: uuid.UUID) -> LoadCarrierOffer | None:
        result = await self.db.execute(
            select(LoadCarrierOffer).where(
                LoadCarrierOffer.load_id == load_id,
                LoadCarrierOffer.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_load(self, load_id: uuid.UUID) -> Sequence[LoadCarrierOffer]:
        result = await self.db.execute(
            select(LoadCarrierOffer).where(LoadCarrierOffer.load_id == load_id)
        )
        return result.scalars().all()

    async def list_pending_for_user(self, user_id: uuid.UUID) -> Sequence[LoadCarrierOffer]:
        result = await self.db.execute(
            select(LoadCarrierOffer).where(
                LoadCarrierOffer.user_id == user_id,
                LoadCarrierOffer.status == CarrierOfferStatus.pending,
            )
        )
        return result.scalars().all()

    async def update_status(
        self,
        offer: LoadCarrierOffer,
        status: CarrierOfferStatus,
        responded_at: datetime | None = None,
    ) -> LoadCarrierOffer:
        offer.status = status
        if responded_at is not None:
            offer.responded_at = responded_at
        elif status != CarrierOfferStatus.pending:
            offer.responded_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.refresh(offer)
        return offer

    async def upsert_pending(self, load_id: uuid.UUID, user_id: uuid.UUID) -> LoadCarrierOffer:
        """Reset an existing offer to pending (for re-offer), or create a new one."""
        existing = await self.get(load_id, user_id)
        if existing:
            existing.status = CarrierOfferStatus.pending
            existing.responded_at = None
            await self.db.flush()
            await self.db.refresh(existing)
            return existing
        return await self.create(load_id=load_id, user_id=user_id)

    async def cancel_others(self, load_id: uuid.UUID, accepted_user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(LoadCarrierOffer)
            .where(
                LoadCarrierOffer.load_id == load_id,
                LoadCarrierOffer.user_id != accepted_user_id,
                LoadCarrierOffer.status == CarrierOfferStatus.pending,
            )
            .values(status=CarrierOfferStatus.cancelled, responded_at=datetime.now(timezone.utc))
        )
        await self.db.flush()
