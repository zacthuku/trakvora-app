import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bid import Bid, BidStatus


class BidRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, bid_id: uuid.UUID) -> Bid | None:
        result = await self.db.execute(select(Bid).where(Bid.id == bid_id))
        return result.scalar_one_or_none()

    async def list_by_load(self, load_id: uuid.UUID) -> list[Bid]:
        result = await self.db.execute(
            select(Bid)
            .options(selectinload(Bid.owner))
            .where(Bid.load_id == load_id)
            .order_by(Bid.amount_kes.asc())
        )
        return result.scalars().all()

    async def list_by_owner(self, owner_id: uuid.UUID) -> list[Bid]:
        result = await self.db.execute(
            select(Bid).where(Bid.owner_id == owner_id).order_by(Bid.created_at.desc())
        )
        return result.scalars().all()

    async def existing_bid(self, load_id: uuid.UUID, owner_id: uuid.UUID) -> Bid | None:
        result = await self.db.execute(
            select(Bid).where(
                Bid.load_id == load_id,
                Bid.owner_id == owner_id,
                Bid.status == BidStatus.pending,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Bid:
        bid = Bid(**kwargs)
        self.db.add(bid)
        await self.db.flush()
        await self.db.refresh(bid)
        return bid

    async def update(self, bid: Bid, **kwargs) -> Bid:
        for key, value in kwargs.items():
            setattr(bid, key, value)
        await self.db.flush()
        await self.db.refresh(bid)
        return bid

    async def list_by_owner_with_load(self, owner_id: uuid.UUID) -> list[Bid]:
        result = await self.db.execute(
            select(Bid)
            .options(selectinload(Bid.load))
            .where(Bid.owner_id == owner_id)
            .order_by(Bid.created_at.desc())
        )
        return result.scalars().all()

    async def reject_all_others(self, load_id: uuid.UUID, accepted_bid_id: uuid.UUID) -> None:
        bids = await self.list_by_load(load_id)
        for bid in bids:
            if bid.id != accepted_bid_id and bid.status == BidStatus.pending:
                bid.status = BidStatus.rejected
        await self.db.flush()
