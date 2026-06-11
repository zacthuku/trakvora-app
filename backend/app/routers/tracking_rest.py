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
import logging

from app.services.geofence_service import is_arriving, is_at_location

logger = logging.getLogger(__name__)
from app.services.notification_service import broadcast_location, send_notification

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
    from sqlalchemy.orm import selectinload
    shipment_result = await db.execute(
        select(Shipment)
        .options(selectinload(Shipment.load))
        .where(
            Shipment.truck_id == truck.id,
            Shipment.status.in_(_ACTIVE_STATUSES),
        )
    )
    shipment = shipment_result.scalar_one_or_none()

    shipment_id = None
    arriving_alert = False          # geofence flag passed to broadcast
    if shipment:
        # Update shipment position
        for attr, val in [
            ("current_latitude", body.latitude),
            ("current_longitude", body.longitude),
        ]:
            setattr(shipment, attr, val)
        await db.flush()
        shipment_id = shipment.id

        # ── Geofence: detect arrival at dropoff (rideshare-style) ────────────
        load = shipment.load
        if load and load.dropoff_latitude and load.dropoff_longitude:
            arriving_alert = is_arriving(
                body.latitude, body.longitude,
                load.dropoff_latitude, load.dropoff_longitude,
            )
            # Log geofence entry for unattended deliveries — scheduler handles auto-transition
            if (
                getattr(load, "unattended_delivery", False)
                and shipment.status == LoadStatus.in_transit
                and is_at_location(body.latitude, body.longitude, load.dropoff_latitude, load.dropoff_longitude)
            ):
                logger.info(
                    "Unattended delivery geofence reached: shipment=%s truck=%s",
                    shipment.id, truck.registration_number,
                )

        # ── ETA computation ──────────────────────────────────────────────────
        if load and load.dropoff_latitude and load.dropoff_longitude:
            try:
                from app.services.eta_service import compute_eta
                eta_dt = await compute_eta(
                    body.latitude, body.longitude,
                    load.dropoff_latitude, load.dropoff_longitude,
                    speed_kmh=body.speed_kmh,
                )
                shipment.eta = eta_dt
                await db.flush()
            except Exception:  # noqa: BLE001
                pass  # non-critical — don't fail the ping

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

    # ── Route deviation detection ────────────────────────────────────────────
    if shipment and load and load.pickup_latitude and load.pickup_longitude \
            and load.dropoff_latitude and load.dropoff_longitude:
        from app.core.geofencing import detect_route_deviation
        from app.models.tracker_alert import AlertSeverity, AlertType, TrackerAlert
        is_dev, dev_km = detect_route_deviation(
            body.latitude, body.longitude,
            load.pickup_latitude, load.pickup_longitude,
            load.dropoff_latitude, load.dropoff_longitude,
            max_deviation_km=25.0,
        )
        if is_dev:
            # Deduplicate: only create if no open route_deviation alert in last 30 min
            from datetime import timedelta
            dedup_cutoff = now - timedelta(minutes=30)
            from sqlalchemy import and_
            existing_dev = (await db.execute(
                select(TrackerAlert).where(
                    and_(
                        TrackerAlert.truck_id == truck.id,
                        TrackerAlert.alert_type == AlertType.route_deviation,
                        TrackerAlert.resolved_at.is_(None),
                        TrackerAlert.created_at >= dedup_cutoff,
                    )
                )
            )).scalar_one_or_none()
            if not existing_dev:
                severity = AlertSeverity.high if dev_km > 50 else AlertSeverity.medium
                db.add(TrackerAlert(
                    truck_id=truck.id,
                    alert_type=AlertType.route_deviation,
                    severity=severity,
                    message=(
                        f"Truck {truck.registration_number} is {dev_km:.1f} km off the "
                        f"expected route corridor ({load.pickup_location or '?'} → "
                        f"{load.dropoff_location or '?'})."
                    ),
                ))
                from app.models.notification import NotificationType
                from app.services.notification_service import notify_all_admins, send_notification
                await notify_all_admins(
                    db=db,
                    title=f"⚠ Route deviation — {truck.registration_number}",
                    body=f"{truck.registration_number} is {dev_km:.1f} km off route.",
                    reference_id=shipment.id,
                    reference_type="route_deviation",
                )
                if shipment.owner_id:
                    await send_notification(
                        user_id=shipment.owner_id,
                        notification_type=NotificationType.system,
                        title=f"⚠ Truck off-route: {truck.registration_number}",
                        body=f"Your truck has deviated {dev_km:.1f} km from the planned route.",
                        reference_id=shipment.id,
                        reference_type="route_deviation",
                        db=db,
                    )

    # ── Auto-resolve open no_ping alert for this truck ──────────────────────
    from app.models.tracker_alert import AlertType, TrackerAlert
    from app.models.notification import NotificationType
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

    # ── Geofence: fire "driver arriving" notification once per approach ──────
    if arriving_alert and shipment:
        load = shipment.load
        if load:
            await send_notification(
                user_id=load.shipper_id,
                notification_type=NotificationType.system,
                title="Driver is arriving",
                body=f"Your truck is within 500 m of the dropoff point at {load.dropoff_location or 'your destination'}.",
                reference_id=shipment.id,
                reference_type="shipment",
                db=db,
            )

    # ── Broadcast via WebSocket ──────────────────────────────────────────────
    if shipment_id:
        eta_iso = shipment.eta.isoformat() if shipment and shipment.eta else None
        await broadcast_location(str(shipment_id), {
            "latitude":  body.latitude,
            "longitude": body.longitude,
            "speed_kmh": body.speed_kmh,
            "heading":   body.heading,
            "source":    "gps_tracker",
            "shipment_id": str(shipment_id),
            "eta":       eta_iso,
            "arriving":  arriving_alert,
        })

    return TrackingPingResponse(
        status="ok",
        shipment_id=str(shipment_id) if shipment_id else None,
    )


@router.get("/public/{shipment_id}/trail", response_model=TrackingTrailOut)
async def get_public_trail(
    shipment_id: uuid.UUID,
    share_token: str,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    shipment = await ShipmentRepository(db).get_by_id(shipment_id)
    if not shipment or shipment.share_token != share_token:
        raise HTTPException(status_code=404, detail="Invalid tracking link")
    limit = min(limit, 1000)
    tracking_repo = TrackingRepository(db)
    points = await tracking_repo.get_trail_by_shipment(shipment_id=shipment_id, limit=limit)
    truck_id_str = str(points[0].truck_id) if points else ""
    return TrackingTrailOut(
        shipment_id=str(shipment_id),
        truck_id=truck_id_str,
        points=[TrackingPointOut.model_validate(p) for p in points],
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


@router.get("/{shipment_id}/playback", response_model=TrackingTrailOut)
async def get_shipment_playback(
    shipment_id: uuid.UUID,
    limit: int = 1000,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Full GPS trail for a shipment, ordered chronologically for playback.
    Identical access rules to /trail; optimised limit default of 1000.
    """
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

    limit = min(limit, 2000)
    tracking_repo = TrackingRepository(db)
    points = await tracking_repo.get_trail_by_shipment(
        shipment_id=shipment_id,
        limit=limit,
        from_dt=from_dt,
        to_dt=to_dt,
    )
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
