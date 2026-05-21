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


async def _prune_old_tracking_points(session_factory) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    async with session_factory() as db:
        repo = TrackingRepository(db)
        deleted = await repo.prune_old(cutoff)
        if deleted:
            await db.commit()


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
    from app.core import inspection_scheduler
    inspection_scheduler.register_jobs(scheduler, session_factory)

    scheduler.start()


def stop() -> None:
    scheduler.shutdown(wait=False)
