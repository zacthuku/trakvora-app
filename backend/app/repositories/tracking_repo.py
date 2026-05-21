import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tracking_point import TrackingPoint, TrackingSource


class TrackingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        truck_id: uuid.UUID,
        latitude: float,
        longitude: float,
        source: TrackingSource,
        shipment_id: uuid.UUID | None = None,
        accuracy: float | None = None,
        speed_kmh: float | None = None,
        heading: float | None = None,
        altitude: float | None = None,
        recorded_at: datetime | None = None,
    ) -> TrackingPoint:
        point = TrackingPoint(
            truck_id=truck_id,
            shipment_id=shipment_id,
            latitude=latitude,
            longitude=longitude,
            source=source,
            accuracy=accuracy,
            speed_kmh=speed_kmh,
            heading=heading,
            altitude=altitude,
            recorded_at=recorded_at or datetime.now(timezone.utc),
        )
        self.db.add(point)
        await self.db.flush()
        return point

    async def get_trail_by_shipment(
        self,
        shipment_id: uuid.UUID,
        limit: int = 500,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
    ) -> list[TrackingPoint]:
        q = (
            select(TrackingPoint)
            .where(TrackingPoint.shipment_id == shipment_id)
            .order_by(TrackingPoint.recorded_at.asc())
        )
        if from_dt:
            q = q.where(TrackingPoint.recorded_at >= from_dt)
        if to_dt:
            q = q.where(TrackingPoint.recorded_at <= to_dt)
        q = q.limit(limit)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_trail_by_truck(
        self,
        truck_id: uuid.UUID,
        limit: int = 500,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
    ) -> list[TrackingPoint]:
        q = (
            select(TrackingPoint)
            .where(TrackingPoint.truck_id == truck_id)
            .order_by(TrackingPoint.recorded_at.asc())
        )
        if from_dt:
            q = q.where(TrackingPoint.recorded_at >= from_dt)
        if to_dt:
            q = q.where(TrackingPoint.recorded_at <= to_dt)
        q = q.limit(limit)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def prune_old(self, cutoff: datetime) -> int:
        result = await self.db.execute(
            delete(TrackingPoint).where(TrackingPoint.recorded_at < cutoff)
        )
        return result.rowcount
