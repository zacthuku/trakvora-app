"""IoT Technician operations — device inventory, alerts, provisioning."""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin_role
from app.models.inspection_task import InspectionTask, TaskStatus, TaskType
from app.models.tracker_alert import AlertSeverity, AlertType, TrackerAlert
from app.models.tracker_device import DeviceInventoryStatus, TrackerDevice
from app.models.truck import Truck
from app.models.user import AdminRole, User
from app.schemas.iot import (
    AlertOut, AlertResolve, DeviceCreate, DeviceOut, DeviceUpdate,
    IoTDashboardOut, IoTTaskCreate,
)

router = APIRouter(prefix="/admin/iot", tags=["iot"])

_IOT_ROLES = (AdminRole.iot_technician, AdminRole.operations_admin)

ONLINE_THRESHOLD_MINS = 15
LOW_BATTERY_THRESHOLD = 20.0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _truck_health(truck: Truck) -> str:
    now = datetime.now(timezone.utc)
    if not truck.gps_tracker_id:
        return "no_tracker"
    if truck.battery_level is not None and truck.battery_level < LOW_BATTERY_THRESHOLD:
        return "low_battery"
    if truck.last_seen_at is None:
        return "no_signal"
    diff = (now - truck.last_seen_at.replace(tzinfo=timezone.utc) if truck.last_seen_at.tzinfo is None else now - truck.last_seen_at)
    if diff > timedelta(minutes=ONLINE_THRESHOLD_MINS):
        return "offline"
    return "online"


def _device_out(device: TrackerDevice) -> DeviceOut:
    d = DeviceOut.model_validate(device)
    if device.truck:
        d.truck_registration = device.truck.registration_number
    return d


def _alert_out(alert: TrackerAlert) -> AlertOut:
    a = AlertOut.model_validate(alert)
    if alert.truck:
        a.truck_registration = alert.truck.registration_number
    if alert.tracker_device:
        a.device_serial = alert.tracker_device.serial_number
    return a


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=IoTDashboardOut)
async def iot_dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    now = datetime.now(timezone.utc)

    # Device health from trucks with trackers
    trucks = (await db.execute(select(Truck))).scalars().all()
    health = {"online": 0, "offline": 0, "low_battery": 0, "no_signal": 0, "total_with_tracker": 0}
    fleet_positions = []

    for t in trucks:
        if not t.gps_tracker_id:
            continue
        health["total_with_tracker"] += 1
        status = _truck_health(t)
        if status in health:
            health[status] += 1
        if t.current_latitude and t.current_longitude:
            fleet_positions.append({
                "truck_id": str(t.id),
                "registration_number": t.registration_number,
                "lat": t.current_latitude,
                "lon": t.current_longitude,
                "health": status,
                "battery": t.battery_level,
                "signal": t.signal_strength,
                "last_seen": t.last_seen_at.isoformat() if t.last_seen_at else None,
            })

    # Installation task counts
    iot_task_types = [TaskType.install, TaskType.replacement, TaskType.re_verification]
    task_rows = (await db.execute(
        select(InspectionTask.task_type, func.count())
        .where(
            InspectionTask.task_type.in_(iot_task_types),
            InspectionTask.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
        .group_by(InspectionTask.task_type)
    )).all()
    tasks = {"pending_installs": 0, "pending_replacements": 0, "pending_verifications": 0}
    for task_type, cnt in task_rows:
        if task_type == TaskType.install:
            tasks["pending_installs"] = cnt
        elif task_type == TaskType.replacement:
            tasks["pending_replacements"] = cnt
        elif task_type == TaskType.re_verification:
            tasks["pending_verifications"] = cnt

    # Alert summary
    alert_rows = (await db.execute(
        select(TrackerAlert.severity, func.count())
        .where(TrackerAlert.resolved_at.is_(None))
        .group_by(TrackerAlert.severity)
    )).all()
    alerts_summary = {"total_active": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
    for sev, cnt in alert_rows:
        alerts_summary[sev] = cnt
        alerts_summary["total_active"] += cnt

    # Recent alerts (unresolved, latest 8)
    recent_raw = (await db.execute(
        select(TrackerAlert)
        .where(TrackerAlert.resolved_at.is_(None))
        .order_by(TrackerAlert.created_at.desc())
        .limit(8)
    )).scalars().all()

    # eager-load related objects manually for alertOut helper
    for ra in recent_raw:
        if ra.tracker_device_id:
            ra.tracker_device  # trigger lazy load (sync — fine in async if already loaded)
        if ra.truck_id:
            ra.truck

    return IoTDashboardOut(
        device_health={**health, "fleet_positions": fleet_positions},
        tasks=tasks,
        alerts_summary=alerts_summary,
        recent_alerts=[_alert_out(a) for a in recent_raw],
    )


# ── Device Inventory ──────────────────────────────────────────────────────────

@router.get("/devices", response_model=dict)
async def list_devices(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    q = select(TrackerDevice)
    if status:
        try:
            q = q.where(TrackerDevice.status == DeviceInventoryStatus(status))
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}")
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(TrackerDevice.created_at.desc()).offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"items": [_device_out(d) for d in items], "total": total, "page": page, "limit": limit}


@router.post("/devices", response_model=DeviceOut, status_code=201)
async def create_device(
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    existing = (await db.execute(
        select(TrackerDevice).where(TrackerDevice.serial_number == payload.serial_number)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Serial number already registered")
    device = TrackerDevice(**payload.model_dump())
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_out(device)


@router.get("/devices/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    device = (await db.execute(select(TrackerDevice).where(TrackerDevice.id == device_id))).scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")
    return _device_out(device)


@router.patch("/devices/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: uuid.UUID,
    payload: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    device = (await db.execute(select(TrackerDevice).where(TrackerDevice.id == device_id))).scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")

    data = payload.model_dump(exclude_unset=True)

    if "status" in data:
        try:
            data["status"] = DeviceInventoryStatus(data["status"])
        except ValueError:
            raise HTTPException(400, f"Invalid status: {data['status']}")

    if "truck_id" in data and data["truck_id"] is not None:
        truck = (await db.execute(select(Truck).where(Truck.id == data["truck_id"]))).scalar_one_or_none()
        if not truck:
            raise HTTPException(404, "Truck not found")
        device.installed_by = current_user.id
        device.installed_at = datetime.now(timezone.utc)
        device.status = DeviceInventoryStatus.installed
        truck.gps_tracker_id = device.serial_number

    for k, v in data.items():
        setattr(device, k, v)

    await db.commit()
    await db.refresh(device)
    return _device_out(device)


@router.post("/devices/{device_id}/provision", response_model=dict)
async def provision_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    """Generate a fresh provisioning secret for the device."""
    device = (await db.execute(select(TrackerDevice).where(TrackerDevice.id == device_id))).scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")

    new_secret = secrets.token_urlsafe(24)
    device.provisioning_secret = new_secret
    device.provisioned_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "device_id":    str(device.id),
        "serial_number": device.serial_number,
        "secret":        new_secret,
        "provisioning_payload": f"trakvora://provision?device={device.serial_number}&secret={new_secret}",
    }


@router.post("/devices/{device_id}/test-ping", response_model=dict)
async def test_ping(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    """Simulate a ping verification — returns current telemetry snapshot from DB."""
    device = (await db.execute(select(TrackerDevice).where(TrackerDevice.id == device_id))).scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")

    # If the device is assigned to a truck, pull live telemetry from the truck
    truck_data = None
    if device.truck_id:
        truck = (await db.execute(select(Truck).where(Truck.id == device.truck_id))).scalar_one_or_none()
        if truck:
            truck_data = {
                "registration_number": truck.registration_number,
                "last_ping_at": truck.last_ping_at.isoformat() if truck.last_ping_at else None,
                "last_seen_at": truck.last_seen_at.isoformat() if truck.last_seen_at else None,
                "battery_level": truck.battery_level,
                "signal_strength": truck.signal_strength,
                "lat": truck.current_latitude,
                "lon": truck.current_longitude,
            }

    now = datetime.now(timezone.utc)
    responding = (
        truck_data is not None
        and truck_data["last_seen_at"] is not None
        and (now - datetime.fromisoformat(truck_data["last_seen_at"])).total_seconds() < ONLINE_THRESHOLD_MINS * 60
    ) if truck_data else False

    return {
        "device_id":   str(device.id),
        "serial_number": device.serial_number,
        "responding":  responding,
        "truck":       truck_data,
        "checked_at":  now.isoformat(),
    }


# ── IoT Installation Tasks ────────────────────────────────────────────────────

@router.get("/tasks", response_model=dict)
async def list_iot_tasks(
    task_type: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    iot_types = [TaskType.install, TaskType.replacement, TaskType.re_verification]
    q = select(InspectionTask).where(InspectionTask.task_type.in_(iot_types))
    if task_type:
        try:
            q = q.where(InspectionTask.task_type == TaskType(task_type))
        except ValueError:
            raise HTTPException(400, f"Invalid task_type: {task_type}")
    if status:
        try:
            q = q.where(InspectionTask.status == TaskStatus(status))
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}")
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(InspectionTask.created_at.desc()).offset((page - 1) * limit).limit(limit))).scalars().all()
    return {
        "items": [
            {
                "id": str(t.id), "truck_id": str(t.truck_id), "task_type": t.task_type.value,
                "status": t.status.value, "location": t.location,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "notes": t.notes, "assigned_to": str(t.assigned_to) if t.assigned_to else None,
                "created_at": t.created_at.isoformat(),
            }
            for t in items
        ],
        "total": total, "page": page, "limit": limit,
    }


@router.post("/tasks", response_model=dict, status_code=201)
async def create_iot_task(
    payload: IoTTaskCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.operations_admin)),
):
    truck = (await db.execute(select(Truck).where(Truck.id == payload.truck_id))).scalar_one_or_none()
    if not truck:
        raise HTTPException(404, "Truck not found")
    try:
        tt = TaskType(payload.task_type)
    except ValueError:
        raise HTTPException(400, f"Invalid task_type. Must be one of: install, replacement, re_verification")
    task = InspectionTask(
        truck_id=payload.truck_id, owner_id=payload.owner_id,
        task_type=tt, status=TaskStatus.pending,
        location=payload.location, deadline=payload.deadline, notes=payload.notes,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return {"id": str(task.id), "task_type": task.task_type.value, "status": task.status.value}


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=dict)
async def list_alerts(
    resolved: bool = Query(False),
    severity: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    q = select(TrackerAlert)
    if resolved:
        q = q.where(TrackerAlert.resolved_at.is_not(None))
    else:
        q = q.where(TrackerAlert.resolved_at.is_(None))
    if severity:
        try:
            q = q.where(TrackerAlert.severity == AlertSeverity(severity))
        except ValueError:
            raise HTTPException(400, f"Invalid severity: {severity}")
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(TrackerAlert.created_at.desc()).offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"items": [_alert_out(a) for a in items], "total": total, "page": page, "limit": limit}


@router.post("/alerts", response_model=AlertOut, status_code=201)
async def create_alert(
    tracker_device_id: uuid.UUID | None = None,
    truck_id: uuid.UUID | None = None,
    alert_type: str = Query(...),
    severity: str = Query("medium"),
    message: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    try:
        at = AlertType(alert_type)
        sev = AlertSeverity(severity)
    except ValueError as e:
        raise HTTPException(400, str(e))
    alert = TrackerAlert(
        tracker_device_id=tracker_device_id, truck_id=truck_id,
        alert_type=at, severity=sev, message=message,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return _alert_out(alert)


@router.patch("/alerts/{alert_id}/resolve", response_model=AlertOut)
async def resolve_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    alert = (await db.execute(select(TrackerAlert).where(TrackerAlert.id == alert_id))).scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "Alert not found")
    if alert.resolved_at:
        raise HTTPException(409, "Alert already resolved")
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolved_by = current_user.id
    await db.commit()
    await db.refresh(alert)
    return _alert_out(alert)


# ── Fleet health for map ──────────────────────────────────────────────────────

@router.get("/fleet-health", response_model=list)
async def fleet_health(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(*_IOT_ROLES)),
):
    trucks = (await db.execute(
        select(Truck).where(Truck.gps_tracker_id.is_not(None), Truck.is_active == True)
    )).scalars().all()
    return [
        {
            "truck_id":            str(t.id),
            "registration_number": t.registration_number,
            "gps_tracker_id":      t.gps_tracker_id,
            "lat":                 t.current_latitude,
            "lon":                 t.current_longitude,
            "health":              _truck_health(t),
            "battery":             t.battery_level,
            "signal":              t.signal_strength,
            "last_seen":           t.last_seen_at.isoformat() if t.last_seen_at else None,
            "last_ping":           t.last_ping_at.isoformat() if t.last_ping_at else None,
        }
        for t in trucks
    ]
