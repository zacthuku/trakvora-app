"""
Recurring inspection and compliance scheduler jobs.

Registered in app/core/scheduler.py via add_inspection_jobs().
Jobs:
  - Daily 06:00: alert owners 30 / 14 / 7 days before driver licence expiry
  - Daily 06:05: alert owners 30 / 14 / 7 days before truck inspection due
  - Daily 06:10: auto-suspend trucks whose last compliance approval is overdue (>365 days)
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.models.driver import Driver
from app.models.notification import Notification, NotificationType
from app.models.truck import Truck, InspectionStatus


_ALERT_DAYS = (30, 14, 7)
_INSPECTION_VALID_DAYS = 365


async def _send_notification(db, user_id, title: str, body: str, ref_id=None, ref_type: str = "truck") -> None:
    notif = Notification(
        user_id=user_id,
        notification_type=NotificationType.system,
        title=title,
        body=body,
        reference_id=str(ref_id) if ref_id else None,
        reference_type=ref_type,
    )
    db.add(notif)


async def alert_expiring_driver_licences(session_factory) -> None:
    """Notify fleet owners when a driver's licence is about to expire."""
    now = datetime.now(timezone.utc).date()
    async with session_factory() as db:
        result = await db.execute(
            select(Driver).where(Driver.licence_expiry.isnot(None))
        )
        drivers = result.scalars().all()
        for driver in drivers:
            if not driver.licence_expiry:
                continue
            days_left = (driver.licence_expiry - now).days
            if days_left not in _ALERT_DAYS:
                continue
            # Notify the driver
            await _send_notification(
                db,
                user_id=driver.user_id,
                title="Licence Expiry Reminder",
                body=f"Your driver's licence expires in {days_left} day(s). Please renew to remain compliant.",
                ref_id=driver.id,
                ref_type="driver",
            )
            # Notify employer if assigned
            if driver.employer_id:
                await _send_notification(
                    db,
                    user_id=driver.employer_id,
                    title=f"Driver Licence Expiring ({days_left}d)",
                    body=f"A driver on your fleet has a licence expiring in {days_left} day(s). Please follow up.",
                    ref_id=driver.id,
                    ref_type="driver",
                )
        await db.commit()


async def alert_trucks_due_inspection(session_factory) -> None:
    """Notify owners when a truck hasn't had a fresh inspection in ~11 months (30-day warning)."""
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(days=_INSPECTION_VALID_DAYS - 30)
    async with session_factory() as db:
        result = await db.execute(
            select(Truck).where(
                Truck.verified_at.isnot(None),
                Truck.verified_at <= threshold,
                Truck.is_active == True,  # noqa: E712
            )
        )
        trucks = result.scalars().all()
        for truck in trucks:
            days_since = (now - truck.verified_at.replace(tzinfo=timezone.utc)).days
            days_left = _INSPECTION_VALID_DAYS - days_since
            if days_left not in _ALERT_DAYS and days_left > 0:
                continue
            await _send_notification(
                db,
                user_id=truck.owner_id,
                title="Vehicle Inspection Due" if days_left > 0 else "Vehicle Inspection Overdue",
                body=(
                    f"Truck {truck.registration_number} inspection expires in {days_left} day(s). "
                    "Book a re-inspection to stay compliant."
                    if days_left > 0
                    else f"Truck {truck.registration_number} inspection has expired. Vehicle will be suspended."
                ),
                ref_id=truck.id,
                ref_type="truck",
            )
        await db.commit()


async def auto_suspend_expired_trucks(session_factory) -> None:
    """
    Suspend trucks whose last approval is older than INSPECTION_VALID_DAYS.
    Sets is_active=False and inspection_status=re_inspection.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=_INSPECTION_VALID_DAYS)
    async with session_factory() as db:
        result = await db.execute(
            select(Truck).where(
                Truck.verified_at.isnot(None),
                Truck.verified_at <= cutoff,
                Truck.is_active == True,  # noqa: E712
            )
        )
        trucks = result.scalars().all()
        for truck in trucks:
            truck.is_active = False
            truck.inspection_status = InspectionStatus.re_inspection
            await _send_notification(
                db,
                user_id=truck.owner_id,
                title="Vehicle Suspended — Inspection Expired",
                body=(
                    f"Truck {truck.registration_number} has been suspended because its "
                    "annual inspection has expired. Submit a re-inspection request to reinstate."
                ),
                ref_id=truck.id,
                ref_type="truck",
            )
        await db.commit()


def register_jobs(scheduler, session_factory) -> None:
    """Register all inspection/compliance jobs on an existing APScheduler instance."""
    scheduler.add_job(
        alert_expiring_driver_licences,
        trigger="cron",
        hour=6,
        minute=0,
        args=[session_factory],
        id="alert_driver_licences",
        replace_existing=True,
    )
    scheduler.add_job(
        alert_trucks_due_inspection,
        trigger="cron",
        hour=6,
        minute=5,
        args=[session_factory],
        id="alert_truck_inspections",
        replace_existing=True,
    )
    scheduler.add_job(
        auto_suspend_expired_trucks,
        trigger="cron",
        hour=6,
        minute=10,
        args=[session_factory],
        id="auto_suspend_trucks",
        replace_existing=True,
    )
