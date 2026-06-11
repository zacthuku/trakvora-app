from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.load import Load, LoadStatus
from app.models.shipment import Shipment
from app.repositories.tracking_repo import TrackingRepository

_NO_PING_THRESHOLD_MINS = 30
_LOW_BATTERY_THRESHOLD  = 20.0
_SIGNAL_LOST_THRESHOLD  = -110

scheduler = AsyncIOScheduler()


async def _auto_release_expired_escrows(session_factory) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    async with session_factory() as db:
        result = await db.execute(
            select(Shipment).where(
                Shipment.status == LoadStatus.delivered,
                Shipment.escrow_released == False,  # noqa: E712
                Shipment.delivered_at <= cutoff,
            )
        )
        shipments = result.scalars().all()
        if not shipments:
            return

        from app.services import payment_service

        for shipment in shipments:
            load = await db.get(Load, shipment.load_id)
            if not load:
                continue
            await payment_service.release_escrow(
                shipment_id=shipment.id,
                shipper_user_id=load.shipper_id,
                owner_user_id=shipment.owner_id,
                amount_kes=float(load.price_kes),
                db=db,
            )
            shipment.escrow_released = True
            shipment.payment_confirmed_at = datetime.now(timezone.utc)

        await db.commit()


async def _auto_renew_subscriptions(session_factory) -> None:
    from app.models.subscription import BillingCycle, Subscription, SubscriptionStatus
    from app.models.user import User as UserModel
    from app.models.wallet import TransactionStatus, TransactionType
    from app.repositories.wallet_repo import WalletRepository
    from app.core.exceptions import InsufficientFunds
    from app.services import email_service

    now = datetime.now(timezone.utc)
    # Subscriptions whose period ends within the next 24 hours (due for renewal)
    due_cutoff = now + timedelta(hours=24)

    async with session_factory() as db:
        result = await db.execute(
            select(Subscription)
            .options(selectinload(Subscription.plan))
            .where(
                Subscription.status == SubscriptionStatus.active,
                Subscription.current_period_end <= due_cutoff,
                Subscription.current_period_end > now - timedelta(hours=1),
            )
        )
        subs = result.scalars().all()

        for sub in subs:
            plan = sub.plan
            if not plan:
                continue
            days = 365 if plan.billing_cycle == BillingCycle.annual else 30
            if plan.price_kes == 0:
                sub.current_period_start = sub.current_period_end
                sub.current_period_end = sub.current_period_end + timedelta(days=days)
                continue
            try:
                repo = WalletRepository(db)
                wallet = await repo.get_by_user(sub.user_id)
                if not wallet or float(wallet.balance_kes) < plan.price_kes:
                    raise InsufficientFunds()
                await repo.update_balance(wallet, balance_delta=-plan.price_kes)
                sub_tx = await repo.create_transaction(
                    wallet_id=wallet.id,
                    transaction_type=TransactionType.subscription_fee,
                    amount_kes=plan.price_kes,
                    status=TransactionStatus.completed,
                    description=f"Subscription renewal: {plan.name}",
                )
                # Generate KRA eTIMS invoice for subscription fee
                from app.services import etims_service
                user_result = await db.execute(select(UserModel).where(UserModel.id == sub.user_id))
                subscriber = user_result.scalar_one_or_none()
                if subscriber:
                    await etims_service.process_and_store_invoice(
                        sub_tx, subscriber, db, plan_name=plan.name
                    )
                sub.current_period_start = sub.current_period_end
                sub.current_period_end = sub.current_period_end + timedelta(days=days)
            except InsufficientFunds:
                sub.status = SubscriptionStatus.past_due
                user_result = await db.execute(select(UserModel).where(UserModel.id == sub.user_id))
                user = user_result.scalar_one_or_none()
                if user:
                    import asyncio
                    asyncio.create_task(
                        email_service.send_subscription_past_due_email(
                            user.email, user.full_name, plan.name, plan.price_kes
                        )
                    )

        await db.commit()


async def _retry_failed_etims_invoices(session_factory) -> None:
    """Re-attempt KRA submission for invoices that failed on first try (max 5 retries)."""
    from app.models.etims import EtimsInvoice, EtimsInvoiceStatus
    from app.services import etims_service

    async with session_factory() as db:
        result = await db.execute(
            select(EtimsInvoice).where(
                EtimsInvoice.status == EtimsInvoiceStatus.failed,
                EtimsInvoice.retry_count < 5,
            )
        )
        invoices = result.scalars().all()
        if not invoices:
            return

        for invoice in invoices:
            await etims_service.retry_failed_invoice(invoice, db)

        await db.commit()


async def _auto_create_iot_alerts(session_factory) -> None:
    from app.models.tracker_alert import AlertSeverity, AlertType, TrackerAlert
    from app.models.truck import Truck

    now = datetime.now(timezone.utc)
    no_ping_cutoff = now - timedelta(minutes=_NO_PING_THRESHOLD_MINS)

    async with session_factory() as db:
        trucks = (await db.execute(
            select(Truck).where(Truck.gps_tracker_id.is_not(None), Truck.is_active == True)  # noqa: E712
        )).scalars().all()

        for truck in trucks:
            # ── no_ping ───────────────────────────────────────────────────────
            if truck.last_ping_at is None or truck.last_ping_at < no_ping_cutoff:
                existing = (await db.execute(
                    select(TrackerAlert).where(
                        TrackerAlert.truck_id == truck.id,
                        TrackerAlert.alert_type == AlertType.no_ping,
                        TrackerAlert.resolved_at.is_(None),
                    )
                )).scalar_one_or_none()
                if not existing:
                    last_ping_str = truck.last_ping_at.strftime("%Y-%m-%d %H:%M UTC") if truck.last_ping_at else "never"
                    db.add(TrackerAlert(
                        truck_id=truck.id,
                        alert_type=AlertType.no_ping,
                        severity=AlertSeverity.high,
                        message=f"Truck {truck.registration_number} has not pinged since {last_ping_str}.",
                    ))

            # ── low_battery ───────────────────────────────────────────────────
            if truck.battery_level is not None and truck.battery_level < _LOW_BATTERY_THRESHOLD:
                existing = (await db.execute(
                    select(TrackerAlert).where(
                        TrackerAlert.truck_id == truck.id,
                        TrackerAlert.alert_type == AlertType.low_battery,
                        TrackerAlert.resolved_at.is_(None),
                    )
                )).scalar_one_or_none()
                if not existing:
                    db.add(TrackerAlert(
                        truck_id=truck.id,
                        alert_type=AlertType.low_battery,
                        severity=AlertSeverity.medium,
                        message=f"Truck {truck.registration_number} tracker battery is {truck.battery_level:.0f}%.",
                    ))

            # ── signal_lost ───────────────────────────────────────────────────
            if truck.signal_strength is not None and truck.signal_strength < _SIGNAL_LOST_THRESHOLD:
                existing = (await db.execute(
                    select(TrackerAlert).where(
                        TrackerAlert.truck_id == truck.id,
                        TrackerAlert.alert_type == AlertType.signal_lost,
                        TrackerAlert.resolved_at.is_(None),
                    )
                )).scalar_one_or_none()
                if not existing:
                    db.add(TrackerAlert(
                        truck_id=truck.id,
                        alert_type=AlertType.signal_lost,
                        severity=AlertSeverity.medium,
                        message=f"Truck {truck.registration_number} signal is {truck.signal_strength} dBm (threshold {_SIGNAL_LOST_THRESHOLD}).",
                    ))

        await db.commit()


async def _check_late_delivery_alerts(session_factory) -> None:
    """Alert admins, shippers, and fleet owners when a shipment is overdue and driver is silent."""
    from datetime import date
    from sqlalchemy import or_
    from app.models.load import Load
    from app.models.truck import Truck
    from app.models.notification import Notification
    from app.services.notification_service import notify_all_admins, send_notification
    from app.models.notification import NotificationType

    now = datetime.now(timezone.utc)
    today_str = date.today().isoformat()      # "YYYY-MM-DD"
    silence_cutoff = now - timedelta(hours=4)
    dedup_window   = now - timedelta(hours=8)

    async with session_factory() as db:
        rows = (await db.execute(
            select(Shipment, Load, Truck)
            .join(Load, Load.id == Shipment.load_id)
            .outerjoin(Truck, Truck.id == Shipment.truck_id)
            .where(
                Shipment.status.in_([
                    LoadStatus.en_route_pickup,
                    LoadStatus.loaded,
                    LoadStatus.in_transit,
                ]),
                Shipment.delivered_at.is_(None),
                Load.delivery_date.isnot(None),
                Load.delivery_date < today_str,
                or_(
                    Truck.last_seen_at.is_(None),
                    Truck.last_seen_at < silence_cutoff,
                ),
            )
        )).all()

        for shipment, load, truck in rows:
            # De-dup: skip if already alerted in last 8h
            existing = (await db.execute(
                select(Notification).where(
                    Notification.reference_id   == shipment.id,
                    Notification.reference_type == "late_delivery",
                    Notification.created_at     >= dedup_window,
                ).limit(1)
            )).scalar_one_or_none()
            if existing:
                continue

            # Compute context strings
            try:
                days_overdue = (date.today() - date.fromisoformat(load.delivery_date)).days
            except Exception:
                days_overdue = "?"

            if truck and truck.last_seen_at:
                hours_silent = round((now - truck.last_seen_at).total_seconds() / 3600, 1)
                silent_str = f"{hours_silent}h ago"
            else:
                silent_str = "no signal recorded"

            route = f"{load.pickup_location or '?'} → {load.dropoff_location or '?'}"

            # 1. Notify all admins
            await notify_all_admins(
                db=db,
                title=f"⚠ Late Delivery — {route}",
                body=(
                    f"Shipment is {days_overdue} day(s) overdue. "
                    f"Driver last communicated {silent_str}. "
                    f"Status: {shipment.status.value}. Load: {str(load.id)[:8]}."
                ),
                reference_id=shipment.id,
                reference_type="late_delivery",
            )

            # 2. Notify shipper (load owner)
            if load.shipper_id:
                await send_notification(
                    user_id=load.shipper_id,
                    notification_type=NotificationType.system,
                    title=f"⚠ Your shipment is overdue — {route}",
                    body=(
                        f"Your cargo has not been delivered by the expected date "
                        f"({load.delivery_date}). The driver has not communicated "
                        f"for {silent_str}. Please contact support or open a dispute."
                    ),
                    reference_id=shipment.id,
                    reference_type="late_delivery",
                    db=db,
                )

            # 3. Notify fleet owner (only if different from shipper)
            if shipment.owner_id and shipment.owner_id != load.shipper_id:
                await send_notification(
                    user_id=shipment.owner_id,
                    notification_type=NotificationType.system,
                    title=f"⚠ Your truck has a late delivery — {route}",
                    body=(
                        f"A shipment assigned to your truck is {days_overdue} day(s) overdue. "
                        f"Driver last communicated {silent_str}. "
                        f"Please contact your driver immediately."
                    ),
                    reference_id=shipment.id,
                    reference_type="late_delivery",
                    db=db,
                )

        await db.commit()


async def _activate_scheduled_loads(session_factory) -> None:
    """
    Every 5 minutes: find loads whose scheduled_at has passed and notify nearby carriers.
    """
    from app.models.load import Load, LoadStatus
    from app.services.notification_service import send_notification
    from app.models.notification import NotificationType
    from sqlalchemy import and_

    now = datetime.now(timezone.utc)

    async with session_factory() as db:
        result = await db.execute(
            select(Load).where(
                and_(
                    Load.status == LoadStatus.available,
                    Load.scheduled_at.isnot(None),
                    Load.scheduled_at <= now,
                )
            )
        )
        loads = result.scalars().all()
        for load in loads:
            # Clear scheduled_at so we don't process again
            load.scheduled_at = None
            # Notify shipper that load is now live
            await send_notification(
                user_id=load.shipper_id,
                notification_type=NotificationType.system,
                title="Your scheduled load is now live",
                body=f"{load.pickup_location} → {load.dropoff_location} is now visible to carriers.",
                reference_id=load.id,
                reference_type="load",
                db=db,
            )
        if loads:
            await db.commit()


async def _detect_offline_drivers(session_factory) -> None:
    """
    Alert admins and fleet owners when a shipment is active but the truck's
    GPS has been silent for more than 60 minutes — potential off-platform activity.

    De-duplication: skips trucks that already have an open offline_driver alert
    created within the last 2 hours.
    """
    from app.models.tracker_alert import AlertSeverity, AlertType, TrackerAlert
    from app.models.truck import Truck
    from app.models.notification import NotificationType
    from app.services.notification_service import notify_all_admins, send_notification
    from sqlalchemy import and_, or_

    now = datetime.now(timezone.utc)
    silence_cutoff = now - timedelta(hours=1)
    dedup_cutoff   = now - timedelta(hours=2)

    async with session_factory() as db:
        rows = (await db.execute(
            select(Shipment, Truck)
            .outerjoin(Truck, Truck.id == Shipment.truck_id)
            .where(
                Shipment.status.in_([
                    LoadStatus.en_route_pickup,
                    LoadStatus.loaded,
                    LoadStatus.in_transit,
                ]),
                Shipment.delivered_at.is_(None),
                or_(
                    Truck.last_seen_at.is_(None),
                    Truck.last_seen_at < silence_cutoff,
                ),
            )
        )).all()

        for shipment, truck in rows:
            if truck is None:
                continue

            # De-dup: skip if open offline_driver alert within 2h
            existing = (await db.execute(
                select(TrackerAlert).where(
                    and_(
                        TrackerAlert.truck_id == truck.id,
                        TrackerAlert.alert_type == AlertType.offline_driver,
                        TrackerAlert.resolved_at.is_(None),
                        TrackerAlert.created_at >= dedup_cutoff,
                    )
                )
            )).scalar_one_or_none()
            if existing:
                continue

            silence_hours = (
                round((now - truck.last_seen_at).total_seconds() / 3600, 1)
                if truck.last_seen_at else "?"
            )
            db.add(TrackerAlert(
                truck_id=truck.id,
                alert_type=AlertType.offline_driver,
                severity=AlertSeverity.high,
                message=(
                    f"Truck {truck.registration_number} has been offline for "
                    f"{silence_hours}h while a shipment is active (status: {shipment.status.value})."
                ),
            ))

            await notify_all_admins(
                db=db,
                title=f"🚨 Driver offline mid-job — {truck.registration_number}",
                body=(
                    f"No GPS signal for {silence_hours}h. "
                    f"Shipment {str(shipment.id)[:8]} is still active."
                ),
                reference_id=shipment.id,
                reference_type="offline_driver",
            )

            if shipment.owner_id:
                await send_notification(
                    user_id=shipment.owner_id,
                    notification_type=NotificationType.system,
                    title=f"🚨 Truck offline: {truck.registration_number}",
                    body=f"No GPS signal for {silence_hours}h. Shipment is active. Check on your driver.",
                    reference_id=shipment.id,
                    reference_type="offline_driver",
                    db=db,
                )

        await db.commit()


async def _send_scheduled_reports(session_factory) -> None:
    """
    Daily job (06:30 EAT / 03:30 UTC) that sends pending periodic reports.
    - daily reports: sent if not sent in last 24 h
    - weekly reports: sent if not sent in last 7 d
    """
    from app.models.scheduled_report import ReportFrequency, ScheduledReport
    from app.models.user import User
    from app.services import email_service, reporting_service

    now = datetime.now(timezone.utc)

    async with session_factory() as db:
        result = await db.execute(
            select(ScheduledReport).where(ScheduledReport.is_active == True)  # noqa: E712
        )
        schedules = result.scalars().all()

        for sched in schedules:
            # Check if due
            if sched.frequency == ReportFrequency.daily:
                due_after = now - timedelta(hours=24)
            else:  # weekly
                due_after = now - timedelta(days=7)

            if sched.last_sent_at and sched.last_sent_at >= due_after:
                continue  # not due yet

            # Get user
            user = (await db.execute(select(User).where(User.id == sched.user_id))).scalar_one_or_none()
            if not user:
                continue

            # Generate report data
            try:
                report_data: dict = {}
                if sched.report_type == "fleet":
                    raw = await reporting_service.generate_fleet_report(str(user.id), db)
                    report_data = {
                        "Total trucks": raw.get("total_trucks", 0),
                        "Active trucks": raw.get("active_trucks", 0),
                        "Total trips (all time)": raw.get("total_trips", 0),
                        "Avg rating": raw.get("average_rating", "N/A"),
                    }
                elif sched.report_type == "shipments":
                    raw = await reporting_service.generate_platform_analytics(db, days=7)
                    report_data = {
                        "Shipments (last 7d)": raw.get("total_shipments", 0),
                        "Delivered (last 7d)": raw.get("delivered_shipments", 0),
                        "Revenue (KES)": raw.get("total_revenue_kes", 0),
                    }
                elif sched.report_type == "analytics":
                    raw = await reporting_service.generate_platform_analytics(db, days=30)
                    report_data = {
                        "Active users": raw.get("total_users", 0),
                        "Loads posted (30d)": raw.get("total_loads", 0),
                        "Shipments (30d)": raw.get("total_shipments", 0),
                        "Revenue (KES)": raw.get("total_revenue_kes", 0),
                    }

                recipient = sched.email_to or user.email
                await email_service.send_scheduled_report_email(
                    to=recipient,
                    name=user.full_name,
                    report_type=sched.report_type,
                    frequency=sched.frequency.value,
                    report_data=report_data,
                )
                sched.last_sent_at = now
            except Exception as exc:  # noqa: BLE001
                import logging
                logging.getLogger(__name__).warning("Failed scheduled report for %s: %s", user.email, exc)

        await db.commit()


async def _prune_old_tracking_points(session_factory) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    async with session_factory() as db:
        repo = TrackingRepository(db)
        deleted = await repo.prune_old(cutoff)
        if deleted:
            await db.commit()


async def _check_overdue_commissions(session_factory) -> None:
    """
    Hourly: enforce commission payment windows.
    Pass 1 — pending invoices past due → mark overdue, suspend owner.
    Pass 2 — retry overdue invoices (wallet may have been topped up) → auto-unblock.
    Pass 3 — opportunistic early-pay of still-pending (not yet overdue).
    """
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    from app.models.notification import NotificationType
    from app.models.user import User as UserModel
    from app.services.commission_service import attempt_commission_payment, unblock_if_cleared
    from app.services.notification_service import send_notification
    from sqlalchemy import and_, or_

    now = datetime.now(timezone.utc)

    async with session_factory() as db:
        # ── Pass 1: pending → overdue ────────────────────────────────────────
        overdue_candidates = (await db.execute(
            select(CommissionInvoice).where(
                CommissionInvoice.status == CommissionInvoiceStatus.pending,
                CommissionInvoice.due_at < now,
                or_(
                    CommissionInvoice.extended_until.is_(None),
                    CommissionInvoice.extended_until < now,
                ),
            )
        )).scalars().all()

        for invoice in overdue_candidates:
            paid = await attempt_commission_payment(invoice, db)
            if paid:
                await unblock_if_cleared(invoice.owner_id, db)
                continue

            invoice.status       = CommissionInvoiceStatus.overdue
            invoice.auto_blocked = True

            owner = await db.get(UserModel, invoice.owner_id)
            if owner and owner.is_active:
                owner.is_active = False

            await send_notification(
                user_id           = invoice.owner_id,
                notification_type = NotificationType.system,
                title             = "Account Suspended — Commission Overdue",
                body              = (
                    f"Your Trakvora commission of KES {float(invoice.amount_kes):,.0f} "
                    f"is overdue. Your account has been suspended. "
                    f"Top up your wallet and your account will be automatically restored."
                ),
                reference_id   = invoice.id,
                reference_type = "commission_invoice",
                db             = db,
            )

        # ── Pass 2: retry overdue invoices (post-topup scenario) ─────────────
        still_overdue = (await db.execute(
            select(CommissionInvoice).where(
                CommissionInvoice.status == CommissionInvoiceStatus.overdue,
            )
        )).scalars().all()

        for invoice in still_overdue:
            paid = await attempt_commission_payment(invoice, db)
            if paid:
                was_unblocked = await unblock_if_cleared(invoice.owner_id, db)
                if was_unblocked:
                    await send_notification(
                        user_id           = invoice.owner_id,
                        notification_type = NotificationType.system,
                        title             = "Commission Paid — Account Restored",
                        body              = (
                            f"Your commission of KES {float(invoice.amount_kes):,.0f} has been settled. "
                            f"Your Trakvora account is now active again."
                        ),
                        reference_id   = invoice.id,
                        reference_type = "commission_invoice",
                        db             = db,
                    )

        # ── Pass 3: opportunistic early-pay of still-pending ─────────────────
        still_pending = (await db.execute(
            select(CommissionInvoice).where(
                CommissionInvoice.status == CommissionInvoiceStatus.pending,
                CommissionInvoice.due_at >= now,
            )
        )).scalars().all()

        for invoice in still_pending:
            await attempt_commission_payment(invoice, db)

        await db.commit()


async def _refresh_fuel_prices(session_factory) -> None:
    """
    Weekly (Monday 04:00 UTC): fetch current diesel prices from internet sources,
    update FuelIndex table, recompute fuel_adjustment_factor = current / baseline.
    Also adjusts corridor_rates.base_rate proportionally so the pricing formula
    stays market-accurate without admin intervention.
    """
    from app.models.corridor_rate import CorridorRate
    from app.models.fuel_index import FuelIndex
    from app.services.fuel_price_service import fetch_current_diesel_prices

    new_prices = await fetch_current_diesel_prices()

    async with session_factory() as db:
        for country_code, new_price in new_prices.items():
            if new_price is None:
                continue

            fi = (await db.execute(
                select(FuelIndex).where(FuelIndex.country_code == country_code)
            )).scalar_one_or_none()

            if not fi:
                continue  # no baseline set; skip

            old_factor = fi.fuel_adjustment_factor
            new_factor = round(new_price / fi.baseline_price, 4)

            fi.current_price          = new_price
            fi.fuel_adjustment_factor = new_factor
            fi.last_fetched_at        = datetime.now(timezone.utc)
            fi.fetch_notes            = f"Auto-fetched; prev_factor={old_factor:.4f}"

        await db.commit()


async def _refresh_price_intelligence(session_factory) -> None:
    """
    Nightly (03:00 UTC): rebuild price_intelligence from accepted bids on delivered loads.
    Groups by (corridor, cargo_type, distance_band, weight_band) and computes p25/p50/p75.
    """
    from app.models.bid import Bid, BidStatus
    from app.models.load import Load, LoadStatus
    from app.models.price_intelligence import PriceIntelligence
    from app.services.pricing_service import detect_corridor, _distance_band, _weight_band

    async with session_factory() as db:
        rows = (await db.execute(
            select(Load, Bid).join(Bid, Bid.load_id == Load.id).where(
                Bid.status == BidStatus.accepted,
                Load.status.in_([LoadStatus.delivered, LoadStatus.booked]),
                Load.distance_km.isnot(None),
                Load.distance_km > 0,
            )
        )).all()

        buckets: dict[tuple, list[float]] = {}
        for load, bid in rows:
            price_per_km = float(bid.amount_kes) / float(load.distance_km)
            corridor = detect_corridor(load.pickup_location or "", load.dropoff_location or "")
            key = (
                corridor,
                str(load.cargo_type.value),
                _distance_band(float(load.distance_km)),
                _weight_band(float(load.weight_tonnes)),
            )
            buckets.setdefault(key, []).append(price_per_km)

        now = datetime.now(timezone.utc)
        for (corridor, cargo, dist_band, wt_band), prices in buckets.items():
            prices.sort()
            n = len(prices)
            p25 = prices[max(0, int(n * 0.25))]
            p50 = prices[max(0, int(n * 0.50))]
            p75 = prices[max(0, int(n * 0.75))]
            avg = sum(prices) / n

            existing = (await db.execute(
                select(PriceIntelligence).where(
                    PriceIntelligence.corridor_key  == corridor,
                    PriceIntelligence.cargo_type    == cargo,
                    PriceIntelligence.distance_band == dist_band,
                    PriceIntelligence.weight_band   == wt_band,
                )
            )).scalar_one_or_none()

            if existing:
                existing.sample_count    = n
                existing.p25_per_km      = p25
                existing.p50_per_km      = p50
                existing.p75_per_km      = p75
                existing.avg_per_km      = avg
                existing.last_updated_at = now
            else:
                db.add(PriceIntelligence(
                    corridor_key=corridor, cargo_type=cargo,
                    distance_band=dist_band, weight_band=wt_band,
                    sample_count=n, p25_per_km=p25, p50_per_km=p50,
                    p75_per_km=p75, avg_per_km=avg, last_updated_at=now,
                ))

        await db.commit()


_AUTO_CONFIRM_HOURS = 48


async def _auto_confirm_direct_deliveries(session_factory) -> None:
    """
    Hourly: auto-confirm direct-payment deliveries where the shipper has not
    acted within 48 hours of the driver marking delivered.

    Creates the commission invoice for Trakvora so payment is always captured
    regardless of shipper engagement. Shipper had the full window to dispute.
    """
    from app.models.load import Load
    from app.models.notification import NotificationType
    from app.models.user import User as UserModel
    from app.services import email_service, payment_service
    from app.services.notification_service import send_notification
    from sqlalchemy import and_

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=_AUTO_CONFIRM_HOURS)

    async with session_factory() as db:
        result = await db.execute(
            select(Shipment).where(
                and_(
                    Shipment.status == LoadStatus.delivered,
                    Shipment.payment_mode == "direct",
                    Shipment.payment_confirmed_at.is_(None),
                    Shipment.dispute_open == False,  # noqa: E712
                    Shipment.delivered_at.isnot(None),
                    Shipment.delivered_at <= cutoff,
                )
            )
        )
        shipments = result.scalars().all()

        for shipment in shipments:
            load = await db.get(Load, shipment.load_id)
            if not load:
                continue

            await payment_service.confirm_direct_payment(
                shipment_id=shipment.id,
                shipper_user_id=load.shipper_id,
                owner_user_id=shipment.owner_id,
                amount_kes=float(load.price_kes),
                db=db,
            )
            shipment.direct_payment_confirmed_at = now
            shipment.payment_confirmed_at = now

            route = f"{load.pickup_location} → {load.dropoff_location}"

            # Notify shipper that auto-confirm happened
            await send_notification(
                user_id=load.shipper_id,
                notification_type=NotificationType.system,
                title="Delivery auto-confirmed",
                body=f"Your shipment ({route}) was automatically confirmed after {_AUTO_CONFIRM_HOURS}h. "
                     "The carrier's commission invoice has been issued.",
                reference_id=shipment.id,
                reference_type="shipment",
                db=db,
            )

            # Notify carrier owner that commission invoice is ready
            if shipment.owner_id:
                await send_notification(
                    user_id=shipment.owner_id,
                    notification_type=NotificationType.system,
                    title="Commission invoice issued",
                    body=f"Delivery for {route} auto-confirmed. Your commission invoice is ready to pay.",
                    reference_id=shipment.id,
                    reference_type="shipment",
                    db=db,
                )

            # Email shipper summary
            shipper = await db.get(UserModel, load.shipper_id)
            if shipper:
                import asyncio as _asyncio
                _asyncio.create_task(
                    email_service.send_shipment_delivered_email(
                        shipper.email, shipper.full_name, route, float(load.price_kes)
                    )
                )

        if shipments:
            await db.commit()


async def _auto_deliver_unattended_tracker_shipments(session_factory) -> None:
    """
    Every 2 minutes: auto-mark unattended deliveries as delivered when the
    hardware GPS tracker is within 150 m of the dropoff point.

    This handles the no-smartphone driver scenario — the truck's IoT tracker
    proves physical presence; no driver UI interaction is needed.
    """
    from app.models.load import Load
    from app.models.truck import Truck
    from app.models.notification import NotificationType
    from app.repositories.load_repo import LoadRepository
    from app.repositories.shipment_repo import ShipmentRepository
    from app.services.geofence_service import is_at_location
    from app.services.notification_service import send_notification
    from sqlalchemy import and_

    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(minutes=10)

    async with session_factory() as db:
        rows = (await db.execute(
            select(Shipment, Truck, Load)
            .join(Truck, Truck.id == Shipment.truck_id)
            .join(Load, Load.id == Shipment.load_id)
            .where(
                and_(
                    Shipment.status == LoadStatus.in_transit,
                    Load.unattended_delivery == True,  # noqa: E712
                    Shipment.delivered_at.is_(None),
                    Truck.last_ping_at.isnot(None),
                    Truck.last_ping_at >= stale_cutoff,
                    Truck.current_latitude.isnot(None),
                    Truck.current_longitude.isnot(None),
                )
            )
        )).all()

        for shipment, truck, load in rows:
            if not (load.dropoff_latitude and load.dropoff_longitude):
                continue

            if not is_at_location(
                truck.current_latitude, truck.current_longitude,
                load.dropoff_latitude, load.dropoff_longitude,
            ):
                continue

            # Truck is within 150 m of dropoff — auto-mark delivered
            place_name = None
            try:
                from app.services import geocoding_service
                place_name = await geocoding_service.reverse_geocode(
                    truck.current_latitude, truck.current_longitude
                )
            except Exception:  # noqa: BLE001
                pass

            shipment.status = LoadStatus.delivered
            shipment.delivered_at = now
            shipment.auto_delivered_at = now
            shipment.delivery_method = "auto_tracker"
            shipment.delivery_latitude = truck.current_latitude
            shipment.delivery_longitude = truck.current_longitude
            if place_name:
                shipment.delivery_location_name = place_name

            load.status = LoadStatus.delivered

            route = f"{load.pickup_location} → {load.dropoff_location}"
            await send_notification(
                user_id=load.shipper_id,
                notification_type=NotificationType.system,
                title="Delivery confirmed via GPS",
                body=f"Your shipment ({route}) has been automatically confirmed. "
                     f"Truck GPS recorded at {place_name or 'the dropoff point'}.",
                reference_id=shipment.id,
                reference_type="shipment",
                db=db,
            )
            if shipment.owner_id:
                await send_notification(
                    user_id=shipment.owner_id,
                    notification_type=NotificationType.system,
                    title="Unattended delivery auto-confirmed",
                    body=f"GPS stamp recorded for {route}. Delivery method: tracker auto-confirm.",
                    reference_id=shipment.id,
                    reference_type="shipment",
                    db=db,
                )
            # SMS the driver so they know the job is closed even without a smartphone
            if shipment.driver_id:
                from app.models.user import User as UserModel
                from app.services import sms_service
                import asyncio as _asyncio
                driver_user = await db.get(UserModel, shipment.driver_id)
                if driver_user and driver_user.phone:
                    _asyncio.create_task(
                        sms_service.send_shipment_status_sms(
                            driver_user.phone,
                            "delivered",
                            route,
                        )
                    )

        await db.commit()


async def _refresh_demand_index(session_factory) -> None:
    """
    Every 30 min: compute real-time demand signal per corridor.
    Ratio = open loads / active trucks per corridor in last 24h.
    Writes result into pricing_service._DEMAND_INDEX (in-memory, no DB write).
    """
    from app.models.load import Load, LoadStatus
    from app.models.truck import Truck
    from app.services.pricing_service import detect_corridor, set_demand_index

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with session_factory() as db:
        # Count open loads per corridor
        open_loads = (await db.execute(
            select(Load).where(
                Load.status.in_([LoadStatus.available, LoadStatus.bidding]),
                Load.created_at >= cutoff,
            )
        )).scalars().all()

        active_trucks = (await db.scalar(
            select(__import__("sqlalchemy", fromlist=["func"]).func.count(Truck.id)).where(
                Truck.is_active.is_(True),
            )
        )) or 1

        corridor_load_counts: dict[str, int] = {}
        for load in open_loads:
            key = detect_corridor(load.pickup_location or "", load.dropoff_location or "")
            corridor_load_counts[key] = corridor_load_counts.get(key, 0) + 1

        total_open = len(open_loads)
        # Simple global demand: ratio of active loads to trucks
        global_ratio = total_open / max(active_trucks, 1)
        # Clamp to 0.80–1.30
        global_factor = max(0.80, min(1.30, round(0.80 + global_ratio * 0.50, 2)))

        new_index: dict[str, float] = {"default": global_factor}
        # Per-corridor refinement (load concentration amplifies local demand)
        for corridor, count in corridor_load_counts.items():
            local_ratio = count / max(active_trucks, 1)
            local_factor = max(0.80, min(1.30, round(0.80 + local_ratio * 0.80, 2)))
            new_index[corridor] = local_factor

        set_demand_index(new_index)


def start(session_factory) -> None:
    scheduler.add_job(
        _auto_release_expired_escrows,
        trigger="interval",
        hours=1,
        args=[session_factory],
        id="auto_release_escrows",
        replace_existing=True,
    )
    scheduler.add_job(
        _prune_old_tracking_points,
        trigger="cron",
        hour=2,
        minute=0,
        args=[session_factory],
        id="prune_tracking_points",
        replace_existing=True,
    )
    scheduler.add_job(
        _auto_renew_subscriptions,
        trigger="cron",
        hour=0,
        minute=30,
        args=[session_factory],
        id="auto_renew_subscriptions",
        replace_existing=True,
    )
    scheduler.add_job(
        _auto_create_iot_alerts,
        trigger="interval",
        minutes=10,
        args=[session_factory],
        id="auto_create_iot_alerts",
        replace_existing=True,
    )
    scheduler.add_job(
        _retry_failed_etims_invoices,
        trigger="interval",
        minutes=30,
        args=[session_factory],
        id="retry_failed_etims_invoices",
        replace_existing=True,
    )
    scheduler.add_job(
        _check_late_delivery_alerts,
        trigger="interval",
        minutes=30,
        args=[session_factory],
        id="check_late_delivery_alerts",
        replace_existing=True,
    )
    scheduler.add_job(
        _detect_offline_drivers,
        trigger="interval",
        minutes=15,
        args=[session_factory],
        id="detect_offline_drivers",
        replace_existing=True,
    )
    scheduler.add_job(
        _send_scheduled_reports,
        trigger="cron",
        hour=3,       # 03:30 UTC = 06:30 EAT
        minute=30,
        args=[session_factory],
        id="send_scheduled_reports",
        replace_existing=True,
    )
    scheduler.add_job(
        _activate_scheduled_loads,
        trigger="interval",
        minutes=5,
        args=[session_factory],
        id="activate_scheduled_loads",
        replace_existing=True,
    )
    scheduler.add_job(
        _check_overdue_commissions,
        trigger="interval",
        hours=1,
        args=[session_factory],
        id="check_overdue_commissions",
        replace_existing=True,
    )
    scheduler.add_job(
        _refresh_fuel_prices,
        trigger="cron",
        day_of_week="mon",
        hour=4,
        minute=0,
        args=[session_factory],
        id="refresh_fuel_prices",
        replace_existing=True,
    )
    scheduler.add_job(
        _refresh_price_intelligence,
        trigger="cron",
        hour=3,
        minute=0,
        args=[session_factory],
        id="refresh_price_intelligence",
        replace_existing=True,
    )
    scheduler.add_job(
        _refresh_demand_index,
        trigger="interval",
        minutes=30,
        args=[session_factory],
        id="refresh_demand_index",
        replace_existing=True,
    )
    scheduler.add_job(
        _auto_deliver_unattended_tracker_shipments,
        trigger="interval",
        minutes=2,
        args=[session_factory],
        id="auto_deliver_unattended",
        replace_existing=True,
    )
    scheduler.add_job(
        _auto_confirm_direct_deliveries,
        trigger="interval",
        hours=1,
        args=[session_factory],
        id="auto_confirm_direct_deliveries",
        replace_existing=True,
    )
    from app.core import inspection_scheduler
    inspection_scheduler.register_jobs(scheduler, session_factory)

    scheduler.start()


def stop() -> None:
    scheduler.shutdown(wait=False)
