import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin_role, require_role
from app.models.load import LoadStatus
from app.models.shipment import Shipment
from app.models.truck import Truck
from app.models.tracking_point import TrackingSource
from app.models.user import AdminRole, UserRole
from app.repositories.load_repo import LoadRepository
from app.repositories.shipment_repo import ShipmentRepository
from app.repositories.tracking_repo import TrackingRepository
from app.repositories.truck_repo import TruckRepository
from app.schemas.tracking import (
    TrackingPingRequest,
    TrackingPingResponse,
    TrackingTrailOut,
    TrackingPointOut,
)
from app.services.notification_service import broadcast_location

router = APIRouter(tags=["tracking"])

_ACTIVE_STATUSES = {
    LoadStatus.en_route_pickup,
    LoadStatus.loaded,
    LoadStatus.in_transit,
}

_MAX_TIMESTAMP_SKEW_SECONDS = 60
_MIN_PING_INTERVAL_SECONDS = 5


@router.post("/device/ping", response_model=TrackingPingResponse)
async def device_ping(
    body: TrackingPingRequest,
    request: Request,
    x_device_secret: str = Header(..., alias="X-Device-Secret"),
    x_timestamp: str = Header(..., alias="X-Timestamp"),
    db: AsyncSession = Depends(get_db),
):
    # ── Replay attack prevention ─────────────────────────────────────────────
    try:
        device_time = datetime.fromisoformat(x_timestamp.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid X-Timestamp")

    now = datetime.now(timezone.utc)
    skew = abs((now - device_time).total_seconds())
    if skew > _MAX_TIMESTAMP_SKEW_SECONDS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Request timestamp expired")

    # ── Device authentication ────────────────────────────────────────────────
    result = await db.execute(
        select(Truck).where(
            Truck.gps_tracker_id == body.tracker_id,
            Truck.tracker_secret == x_device_secret,
        )
    )
    truck = result.scalar_one_or_none()
    # Same 401 for wrong id or wrong secret — never leak which field failed
    if not truck:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device credentials")

    # ── Rate limiting (5-second minimum interval) ────────────────────────────
    if truck.last_ping_at:
        elapsed = (now - truck.last_ping_at).total_seconds()
        if elapsed < _MIN_PING_INTERVAL_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too fast. Minimum ping interval is {_MIN_PING_INTERVAL_SECONDS} seconds.",
                headers={"Retry-After": str(_MIN_PING_INTERVAL_SECONDS)},
            )

    # ── Update truck state ───────────────────────────────────────────────────
    client_ip = request.client.host if request.client else None
    truck_repo = TruckRepository(db)
    await truck_repo.update(
        truck,
        current_latitude=body.latitude,
        current_longitude=body.longitude,
        last_ping_at=now,
        last_ping_ip=client_ip,
        last_seen_at=now,
        battery_level=body.battery,
        signal_strength=body.signal,
    )

    # ── Find active shipment for this truck ──────────────────────────────────
    shipment_result = await db.execute(
        select(Shipment).where(
            Shipment.truck_id == truck.id,
            Shipment.status.in_(_ACTIVE_STATUSES),
        )
    )
    shipment = shipment_result.scalar_one_or_none()

    shipment_id = None
    if shipment:
        # Update shipment position
        for attr, val in [
            ("current_latitude", body.latitude),
            ("current_longitude", body.longitude),
        ]:
            setattr(shipment, attr, val)
        await db.flush()
        shipment_id = shipment.id

    # ── Record tracking point ────────────────────────────────────────────────
    recorded_at = body.timestamp or now
    tracking_repo = TrackingRepository(db)
    await tracking_repo.create(
        truck_id=truck.id,
        shipment_id=shipment_id,
        latitude=body.latitude,
        longitude=body.longitude,
        source=TrackingSource.gps_tracker,
        accuracy=body.accuracy,
        speed_kmh=body.speed_kmh,
        heading=body.heading,
        altitude=body.altitude,
        recorded_at=recorded_at,
    )

    # ── Auto-resolve open no_ping alert for this truck ──────────────────────
    from app.models.tracker_alert import AlertType, TrackerAlert
    open_no_ping = (await db.execute(
        select(TrackerAlert).where(
            TrackerAlert.truck_id == truck.id,
            TrackerAlert.alert_type == AlertType.no_ping,
            TrackerAlert.resolved_at.is_(None),
        )
    )).scalar_one_or_none()
    if open_no_ping:
        open_no_ping.resolved_at = now

    await db.commit()

    # ── Broadcast via WebSocket ──────────────────────────────────────────────
    if shipment_id:
        await broadcast_location(str(shipment_id), {
            "latitude": body.latitude,
            "longitude": body.longitude,
            "speed_kmh": body.speed_kmh,
            "heading": body.heading,
            "source": "gps_tracker",
            "shipment_id": str(shipment_id),
        })

    return TrackingPingResponse(
        status="ok",
        shipment_id=str(shipment_id) if shipment_id else None,
    )


@router.get("/{shipment_id}/trail", response_model=TrackingTrailOut)
async def get_shipment_trail(
    shipment_id: uuid.UUID,
    limit: int = 500,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        shipment = await ShipmentRepository(db).get_by_id(shipment_id)
        if not shipment:
            raise HTTPException(status_code=404, detail="Shipment not found")
        allowed = {shipment.driver_id, shipment.owner_id}
        load = await LoadRepository(db).get_by_id(shipment.load_id)
        if load:
            allowed.add(load.shipper_id)
        if current_user.id not in allowed:
            raise HTTPException(status_code=403, detail="Access denied")

    limit = min(limit, 1000)
    tracking_repo = TrackingRepository(db)
    points = await tracking_repo.get_trail_by_shipment(
        shipment_id=shipment_id,
        limit=limit,
        from_dt=from_dt,
        to_dt=to_dt,
    )

    # Resolve truck_id from the first point or from the shipment itself
    truck_id_str = str(points[0].truck_id) if points else ""

    return TrackingTrailOut(
        shipment_id=str(shipment_id),
        truck_id=truck_id_str,
        points=[TrackingPointOut.model_validate(p) for p in points],
    )


@router.get("/truck/{truck_id}/trail", response_model=TrackingTrailOut)
async def get_truck_trail(
    truck_id: uuid.UUID,
    limit: int = 500,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role(UserRole.admin)),
):
    """Full telemetry for a truck including periods outside active shipments."""
    limit = min(limit, 1000)
    tracking_repo = TrackingRepository(db)
    points = await tracking_repo.get_trail_by_truck(
        truck_id=truck_id,
        limit=limit,
        from_dt=from_dt,
        to_dt=to_dt,
    )

    return TrackingTrailOut(
        shipment_id=None,
        truck_id=str(truck_id),
        points=[TrackingPointOut.model_validate(p) for p in points],
    )
