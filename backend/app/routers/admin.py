import asyncio
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.database import get_db
from app.dependencies import get_current_user, require_admin_role, require_role
from app.models.activity_log import ActivityLog
from app.models.compliance_review import ComplianceReview
from app.models.country_config import CountryConfig
from app.models.driver import AvailabilityStatus, Driver, VerificationStatus
from app.models.inspection_task import InspectionTask, TaskStatus
from app.models.load import Load, LoadStatus
from app.models.notification import Notification, NotificationType
from app.models.platform_config import PlatformConfig
from app.models.platform_profile import PlatformProfile
from app.models.shipment import Shipment
from app.models.subscription import SubscriptionPlan
from app.models.truck import InspectionStatus, Truck
from app.schemas.truck import AdminTruckVerifyAction
from app.models.user import AdminRole, KycStatus, User, UserRole
from app.models.vehicle_inspection import VehicleInspection
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.models.etims import EtimsInvoice
from app.models.payroll import EmployeeSalary, PayrollStatus
from app.services import email_service, notification_service, payment_service
from app.services.activity_service import log_activity
from app.services.kyc_service import verify_driver_licence
from app.services.ntsa_service import verify_plate as ntsa_verify_plate

router = APIRouter(prefix="/admin", tags=["admin"])

# Actions visible to each admin role (None = all)
ACTIVITY_VISIBLE_ACTIONS: dict = {
    AdminRole.super_admin:        None,
    AdminRole.operations_admin:   [
        "demo_requested", "driver_verified", "driver_rejected",
        "load_cancelled", "dispute_resolved",
        "withdrawal_approved", "withdrawal_rejected",
        "truck_deactivated", "truck_activated",
    ],
    AdminRole.finance_admin:      [
        "withdrawal_approved", "withdrawal_rejected",
        "escrow_release", "escrow_refund",
        "payout", "platform_fee",
        "subscription_payment", "subscription_cancelled",
        "dispute_hold", "dispute_resolved",
    ],
    AdminRole.support_agent:      [
        "user_registered", "user_suspended", "user_unsuspended",
        "user_verified", "user_unverified",
        "kyc_approved", "kyc_rejected", "dispute_resolved",
    ],
    AdminRole.field_inspector:    ["driver_verified", "driver_rejected"],
    AdminRole.compliance_officer: ["driver_verified", "driver_rejected"],
    AdminRole.iot_technician:     [],
}


def _require_admin():
    return Depends(require_role(UserRole.admin))


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    # User counts
    total_users = await db.scalar(select(func.count()).select_from(User))
    active_users = await db.scalar(select(func.count()).select_from(User).where(User.is_active))
    suspended_users = await db.scalar(select(func.count()).select_from(User).where(~User.is_active))
    verified_users = await db.scalar(select(func.count()).select_from(User).where(User.is_verified))

    role_rows = (await db.execute(
        select(User.role, func.count().label("cnt")).group_by(User.role)
    )).all()
    users_by_role = {str(r.role): r.cnt for r in role_rows}

    # Load counts
    total_loads = await db.scalar(select(func.count()).select_from(Load))
    load_rows = (await db.execute(
        select(Load.status, func.count().label("cnt")).group_by(Load.status)
    )).all()
    loads_by_status = {str(r.status): r.cnt for r in load_rows}

    # Shipment counts
    total_shipments = await db.scalar(select(func.count()).select_from(Shipment))
    active_shipments = await db.scalar(
        select(func.count()).select_from(Shipment).where(
            Shipment.status.in_([LoadStatus.en_route_pickup, LoadStatus.loaded, LoadStatus.in_transit])
        )
    )
    delivered_shipments = await db.scalar(
        select(func.count()).select_from(Shipment).where(Shipment.status == LoadStatus.delivered)
    )
    open_disputes = await db.scalar(
        select(func.count()).select_from(Shipment).where(Shipment.dispute_open == True)  # noqa: E712
    )

    # Driver verification
    pending_verifications = await db.scalar(
        select(func.count()).select_from(Driver).where(
            Driver.verification_status == VerificationStatus.pending
        )
    )
    verified_drivers = await db.scalar(
        select(func.count()).select_from(Driver).where(
            Driver.verification_status == VerificationStatus.approved
        )
    )
    available_drivers = await db.scalar(
        select(func.count()).select_from(Driver).where(
            Driver.availability_status == AvailabilityStatus.available
        )
    )

    # Truck counts
    total_trucks = await db.scalar(select(func.count()).select_from(Truck))
    active_trucks = await db.scalar(
        select(func.count()).select_from(Truck).where(Truck.is_active == True)  # noqa: E712
    )

    # Financial
    platform_revenue = await db.scalar(
        select(func.coalesce(func.sum(Transaction.amount_kes), 0)).where(
            Transaction.transaction_type == TransactionType.platform_fee,
            Transaction.status == TransactionStatus.completed,
        )
    )
    total_wallet_balance = await db.scalar(
        select(func.coalesce(func.sum(Wallet.balance_kes), 0))
    )
    total_escrow = await db.scalar(
        select(func.coalesce(func.sum(Wallet.escrow_kes), 0))
    )
    total_transactions = await db.scalar(select(func.count()).select_from(Transaction))
    wallet_currency_rows = (await db.execute(
        select(
            Wallet.currency,
            func.coalesce(func.sum(Wallet.balance_kes), 0),
            func.coalesce(func.sum(Wallet.escrow_kes), 0),
        ).group_by(Wallet.currency)
    )).all()

    # Field ops
    pending_tasks = await db.scalar(
        select(func.count()).select_from(InspectionTask).where(InspectionTask.status == TaskStatus.pending)
    )
    in_progress_tasks = await db.scalar(
        select(func.count()).select_from(InspectionTask).where(InspectionTask.status == TaskStatus.in_progress)
    )

    # Compliance — inspections submitted but not yet reviewed
    reviewed_ids_sq = select(ComplianceReview.inspection_id)
    pending_compliance = await db.scalar(
        select(func.count()).select_from(VehicleInspection).where(
            VehicleInspection.id.not_in(reviewed_ids_sq),
            VehicleInspection.submitted_at.is_not(None),
        )
    )

    # Recent activity from audit log (role-filtered)
    admin_user = (await db.execute(select(User).where(User.id == _.id))).scalar_one_or_none() if hasattr(_, "id") else None
    act_q = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(12)
    recent_logs = (await db.execute(act_q)).scalars().all()

    recent_activity = [
        {
            "id": str(log.id),
            "type": log.action,
            "title": log.action.replace("_", " ").title(),
            "body": log.summary,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_name": log.actor_name or "System",
            "user_role": log.actor_role or "system",
        }
        for log in recent_logs
    ]

    return {
        "users": {
            "total": total_users or 0,
            "active": active_users or 0,
            "suspended": suspended_users or 0,
            "verified": verified_users or 0,
            "by_role": users_by_role,
        },
        "loads": {
            "total": total_loads or 0,
            "by_status": loads_by_status,
        },
        "shipments": {
            "total": total_shipments or 0,
            "active": active_shipments or 0,
            "delivered": delivered_shipments or 0,
            "open_disputes": open_disputes or 0,
        },
        "drivers": {
            "pending_verifications": pending_verifications or 0,
            "verified": verified_drivers or 0,
            "available": available_drivers or 0,
        },
        "trucks": {
            "total": total_trucks or 0,
            "active": active_trucks or 0,
        },
        "field_ops": {
            "pending_tasks": pending_tasks or 0,
            "in_progress_tasks": in_progress_tasks or 0,
        },
        "compliance": {
            "pending_reviews": pending_compliance or 0,
        },
        "finance": {
            "platform_revenue_kes": float(platform_revenue or 0),
            "total_wallet_balance_kes": float(total_wallet_balance or 0),
            "total_escrow_kes": float(total_escrow or 0),
            "currency_totals": [
                {
                    "currency": currency,
                    "total_wallet_balance": float(balance or 0),
                    "total_escrow": float(escrow or 0),
                }
                for currency, balance, escrow in wallet_currency_rows
            ],
            "total_transactions": total_transactions or 0,
        },
        "recent_activity": recent_activity,
    }


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def admin_list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    role: str | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    kyc_status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    q = select(User)
    if role:
        q = q.where(User.role == role)
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    if kyc_status:
        q = q.where(User.kyc_status == kyc_status)
    if search:
        term = f"%{search}%"
        q = q.where(User.full_name.ilike(term) | User.email.ilike(term))

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "phone": u.phone,
                "company_name": u.company_name,
                "role":       u.role.value,
                "admin_role": u.admin_role.value if u.admin_role else None,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "kyc_status": u.kyc_status.value if u.kyc_status else "unverified",
                "kyc_rejection_reason": u.kyc_rejection_reason,
                "rating": u.rating,
                "total_trips": u.total_trips,
                "partner_tier": u.partner_tier.value if u.partner_tier else "standard",
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in rows
        ],
    }


@router.patch("/users/{user_id}/suspend")
async def toggle_suspend_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = not user.is_active
    action = "user_unsuspended" if user.is_active else "user_suspended"
    await log_activity(db, action=action, actor=admin, resource_type="user", resource_id=user.id,
        summary=f"{admin.full_name} {'reactivated' if user.is_active else 'suspended'} user {user.full_name} ({user.email})")
    await notification_service.send_notification(
        user_id=user.id,
        notification_type=NotificationType.system,
        title="Account Update",
        body="Your account has been reactivated." if user.is_active else "Your account has been suspended. Contact support.",
        db=db,
    )
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "is_active": user.is_active}


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_role(AdminRole.super_admin, AdminRole.finance_admin)),
) -> dict[str, Any]:
    """Permanently ban a user. Blocks all known identifiers from re-registration."""
    from pydantic import BaseModel as _BM

    class BanRequest(_BM):
        reason: str

    from fastapi import Request as _Req
    # Parse body inline to avoid cluttering top-level schemas
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already banned")

    user.is_banned = True
    user.is_active = False
    user.ban_reason = "Banned by admin"
    user.ban_snapshot = {
        "email": user.email,
        "phone": user.phone,
        "national_id": user.national_id,
        "kra_pin": user.kra_pin,
        "banned_at": datetime.now(timezone.utc).isoformat(),
        "banned_by_id": str(admin.id),
        "banned_by_name": admin.full_name,
    }
    await log_activity(
        db, action="user_banned", actor=admin, resource_type="user", resource_id=user.id,
        summary=f"{admin.full_name} permanently banned {user.full_name} ({user.email})",
    )
    await notification_service.send_notification(
        user_id=user.id,
        notification_type=NotificationType.system,
        title="Account Suspended",
        body="Your account has been permanently suspended. Contact support if you believe this is an error.",
        db=db,
    )
    await db.commit()
    return {"id": str(user.id), "is_banned": True}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    """Remove a permanent ban (super_admin only)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_banned:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is not banned")

    user.is_banned = False
    user.is_active = True
    user.ban_reason = None
    user.ban_snapshot = None
    await log_activity(
        db, action="user_unbanned", actor=admin, resource_type="user", resource_id=user.id,
        summary=f"{admin.full_name} lifted permanent ban on {user.full_name} ({user.email})",
    )
    await db.commit()
    return {"id": str(user.id), "is_banned": False}


@router.patch("/users/{user_id}/verify")
async def toggle_verify_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_verified = not user.is_verified
    action = "user_verified" if user.is_verified else "user_unverified"
    await log_activity(db, action=action, actor=admin, resource_type="user", resource_id=user.id,
        summary=f"{admin.full_name} {'verified' if user.is_verified else 'unverified'} user {user.full_name}")
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "is_verified": user.is_verified}


class KYCReviewPayload(BaseModel):
    approved: bool
    reason: str | None = None


@router.patch("/users/{user_id}/kyc-review")
async def review_kyc(
    user_id: uuid.UUID,
    payload: KYCReviewPayload,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.kyc_status = KycStatus.approved if payload.approved else KycStatus.rejected
    user.kyc_rejection_reason = None if payload.approved else (payload.reason or "Identity verification failed")
    user.is_verified = payload.approved
    action = "kyc_approved" if payload.approved else "kyc_rejected"
    await log_activity(db, action=action, actor=admin, resource_type="user", resource_id=user.id,
        summary=f"{admin.full_name} {'approved' if payload.approved else 'rejected'} KYC for {user.full_name}",
        meta={"reason": user.kyc_rejection_reason})
    await notification_service.send_notification(
        user_id=user.id,
        notification_type=NotificationType.system,
        title="KYC Approved" if payload.approved else "KYC Rejected",
        body="Your identity verification has been approved. Your account is now fully verified." if payload.approved
             else f"Your KYC was rejected: {user.kyc_rejection_reason}. Please re-submit with correct documents.",
        db=db,
    )
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "kyc_status": user.kyc_status.value,
        "kyc_rejection_reason": user.kyc_rejection_reason,
        "is_verified": user.is_verified,
    }


class CapabilityPayload(BaseModel):
    can_carry: bool | None = None
    can_ship: bool | None = None


@router.patch("/users/{user_id}/capabilities")
async def update_user_capabilities(
    user_id: uuid.UUID,
    payload: CapabilityPayload,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    """Toggle cross-role capability flags. Restricted to super_admin only."""
    if admin.admin_role != AdminRole.super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admins can modify capabilities")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.can_carry is not None:
        user.can_carry = payload.can_carry
    if payload.can_ship is not None:
        user.can_ship = payload.can_ship
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "can_carry": user.can_carry, "can_ship": user.can_ship}


@router.patch("/users/{user_id}/partner-tier")
async def set_partner_tier(
    user_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict:
    """Set the marketplace trust tier for a logistics partner. Restricted to super_admin and finance_admin."""
    from app.models.user import PartnerTier
    if admin.admin_role not in (AdminRole.super_admin, AdminRole.finance_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient admin role")
    tier_val = payload.get("partner_tier")
    if tier_val not in (t.value for t in PartnerTier):
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {[t.value for t in PartnerTier]}")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.partner_tier = PartnerTier(tier_val)
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "partner_tier": user.partner_tier.value}


# ── Drivers ───────────────────────────────────────────────────────────────────

@router.get("/drivers")
async def admin_list_drivers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    verification_status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    q = select(Driver, User).join(User, User.id == Driver.user_id)
    if verification_status:
        q = q.where(Driver.verification_status == verification_status)

    count_q = select(func.count()).select_from(Driver)
    if verification_status:
        count_q = count_q.where(Driver.verification_status == verification_status)
    total = await db.scalar(count_q)
    rows = (await db.execute(
        q.order_by(Driver.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(d.id),
                "user_id": str(d.user_id),
                "full_name": u.full_name,
                "email": u.email,
                "phone": u.phone,
                "rating": u.rating,
                "total_trips": u.total_trips,
                "licence_number": d.licence_number,
                "licence_class": d.licence_class,
                "licence_expiry": d.licence_expiry,
                "verification_status": str(d.verification_status),
                "ntsa_verified": d.ntsa_verified,
                "availability_status": str(d.availability_status),
                "availability_location": d.availability_location,
                "experience_years": d.experience_years,
                "has_licence_photo": bool(d.licence_photo_url),
                "has_passport_photo": bool(d.passport_photo_url),
                "has_psv_badge": bool(d.psv_badge_url),
                "has_police_clearance": bool(d.police_clearance_url),
                "has_good_conduct": bool(d.good_conduct_url),
                "has_medical_cert": bool(d.medical_cert_url),
                "documents_submitted": d.documents_submitted,
                "verification_notes": d.verification_notes,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d, u in rows
        ],
    }


@router.get("/drivers/{driver_id}")
async def admin_get_driver(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    row = (await db.execute(
        select(Driver, User).join(User, User.id == Driver.user_id).where(Driver.id == driver_id)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Driver not found")
    d, u = row
    return {
        "id": str(d.id),
        "user_id": str(d.user_id),
        "full_name": u.full_name,
        "email": u.email,
        "phone": u.phone,
        "rating": u.rating,
        "total_trips": u.total_trips,
        "licence_number": d.licence_number,
        "licence_class": d.licence_class,
        "licence_expiry": d.licence_expiry,
        "verification_status": str(d.verification_status),
        "ntsa_verified": d.ntsa_verified,
        "availability_status": str(d.availability_status),
        "experience_years": d.experience_years,
        "documents_submitted": d.documents_submitted,
        "verification_notes": d.verification_notes,
        "licence_check_status": d.licence_check_status,
        "licence_check_detail": d.licence_check_detail,
        "licence_check_at": d.licence_check_at.isoformat() if d.licence_check_at else None,
        "licence_photo_url": d.licence_photo_url,
        "passport_photo_url": d.passport_photo_url,
        "psv_badge_url": d.psv_badge_url,
        "police_clearance_url": d.police_clearance_url,
        "good_conduct_url": d.good_conduct_url,
        "medical_cert_url": d.medical_cert_url,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


@router.patch("/drivers/{driver_id}/verification")
async def update_driver_verification(
    driver_id: uuid.UUID,
    payload: dict[str, str],
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    driver = (await db.execute(select(Driver).where(Driver.id == driver_id))).scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    new_status = payload.get("status")
    notes = payload.get("notes")
    if new_status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    driver.verification_status = new_status
    driver.ntsa_verified = new_status == "approved"
    if new_status == "rejected" and notes:
        driver.verification_notes = notes
    elif new_status == "approved":
        driver.verification_notes = None  # clear on approval
    action = "driver_verified" if new_status == "approved" else ("driver_rejected" if new_status == "rejected" else "driver_pending")
    driver_user = (await db.execute(select(User).where(User.id == driver.user_id))).scalar_one_or_none()
    driver_name = driver_user.full_name if driver_user else str(driver.user_id)
    await log_activity(db, action=action, actor=admin, resource_type="driver", resource_id=driver.id,
        summary=f"{admin.full_name} set driver {driver_name} verification to {new_status}")
    if driver_user and new_status in ("approved", "rejected"):
        notif_body = (
            "Congratulations! Your driver profile has been verified. You can now bid on loads."
            if new_status == "approved"
            else f"Your driver verification was not approved. {('Reason: ' + notes) if notes else 'Please check your documents and re-submit.'}"
        )
        await notification_service.send_notification(
            user_id=driver_user.id,
            notification_type=NotificationType.system,
            title="Driver Verification Update",
            body=notif_body,
            db=db,
        )
    await db.commit()
    await db.refresh(driver)
    return {
        "id": str(driver.id),
        "verification_status": str(driver.verification_status),
        "ntsa_verified": driver.ntsa_verified,
        "verification_notes": driver.verification_notes,
    }


@router.post("/drivers/{driver_id}/retrigger-check", status_code=202)
async def retrigger_driver_licence_check(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, str]:
    """Admin manually re-triggers the NTSA driving licence check via Smile Identity."""
    driver = (await db.execute(select(Driver).where(Driver.id == driver_id))).scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    driver_user = (await db.execute(select(User).where(User.id == driver.user_id))).scalar_one_or_none()
    country = (driver_user.country if driver_user else None) or "KE"

    async def _check() -> None:
        from app.database import AsyncSessionLocal
        from app.repositories.driver_repo import DriverRepository
        async with AsyncSessionLocal() as session:
            repo = DriverRepository(session)
            d = await repo.get_by_id(driver_id)
            if not d:
                return
            await repo.update(d, licence_check_status="pending")
            passed, detail = await verify_driver_licence(d.licence_number, country.upper())
            await repo.update(
                d,
                licence_check_status="passed" if passed else "failed",
                licence_check_at=datetime.now(timezone.utc),
                licence_check_detail=detail,
            )

    asyncio.ensure_future(_check())
    return {"status": "check_started"}



# ── Loads ─────────────────────────────────────────────────────────────────────

@router.get("/loads")
async def admin_list_loads(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    load_status: str | None = Query(None, alias="status"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    q = select(Load, User).join(User, User.id == Load.shipper_id)
    if load_status:
        q = q.where(Load.status == load_status)
    if search:
        term = f"%{search}%"
        q = q.where(Load.pickup_location.ilike(term) | Load.dropoff_location.ilike(term))

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(Load.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(lo.id),
                "shipper_name": u.full_name,
                "shipper_email": u.email,
                "pickup_location": lo.pickup_location,
                "dropoff_location": lo.dropoff_location,
                "corridor": lo.corridor,
                "cargo_type": str(lo.cargo_type),
                "weight_tonnes": lo.weight_tonnes,
                "price_kes": float(lo.price_kes),
                "booking_mode": str(lo.booking_mode),
                "status": str(lo.status),
                "pickup_date": lo.pickup_date,
                "requires_insurance": lo.requires_insurance,
                "created_at": lo.created_at.isoformat() if lo.created_at else None,
            }
            for lo, u in rows
        ],
    }


@router.patch("/loads/{load_id}/cancel")
async def admin_cancel_load(
    load_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    load = (await db.execute(select(Load).where(Load.id == load_id))).scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Load not found")
    load.status = LoadStatus.cancelled
    await log_activity(db, action="load_cancelled", actor=admin, resource_type="load", resource_id=load.id,
        summary=f"{admin.full_name} cancelled load {load.id} ({load.pickup_location} → {load.dropoff_location})")
    await db.commit()
    return {"id": str(load.id), "status": "cancelled"}


# ── Shipments ─────────────────────────────────────────────────────────────────

@router.get("/shipments")
async def admin_list_shipments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    disputes_only: bool = False,
    ship_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    q = (
        select(Shipment, Load, User, Truck)
        .join(Load, Load.id == Shipment.load_id)
        .join(User, User.id == Load.shipper_id)
        .outerjoin(Truck, Truck.id == Shipment.truck_id)
    )
    if disputes_only:
        q = q.where(Shipment.dispute_open == True)  # noqa: E712
    if ship_status:
        q = q.where(Shipment.status == ship_status)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(Shipment.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(sh.id),
                "load_id": str(sh.load_id),
                "pickup_location": lo.pickup_location,
                "dropoff_location": lo.dropoff_location,
                "corridor": lo.corridor,
                "shipper_name": u.full_name,
                "status": str(sh.status),
                "escrow_locked": sh.escrow_locked,
                "escrow_released": sh.escrow_released,
                "dispute_open": sh.dispute_open,
                "dispute_reason": sh.dispute_reason,
                "dispute_opened_at": sh.dispute_opened_at.isoformat() if sh.dispute_opened_at else None,
                "price_kes": float(lo.price_kes),
                "delivered_at": sh.delivered_at.isoformat() if sh.delivered_at else None,
                "created_at": sh.created_at.isoformat() if sh.created_at else None,
                "delivery_date": lo.delivery_date,
                "last_seen_at": tr.last_seen_at.isoformat() if tr and tr.last_seen_at else None,
            }
            for sh, lo, u, tr in rows
        ],
    }


@router.get("/shipments/{shipment_id}/dispute-evidence")
async def admin_get_dispute_evidence(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    from app.models.tracking_point import TrackingPoint

    row = (await db.execute(
        select(Shipment, Load)
        .join(Load, Load.id == Shipment.load_id)
        .where(Shipment.id == shipment_id)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")
    sh, lo = row

    # Last 100 GPS points for this shipment
    gps_rows = (await db.execute(
        select(TrackingPoint)
        .where(TrackingPoint.shipment_id == shipment_id)
        .order_by(TrackingPoint.recorded_at.desc())
        .limit(100)
    )).scalars().all()

    gps_trail = [
        {
            "lat": p.latitude, "lng": p.longitude,
            "recorded_at": p.recorded_at.isoformat(),
            "source": str(p.source),
            "speed_kmh": p.speed_kmh,
        }
        for p in reversed(gps_rows)
    ]

    return {
        "shipment_id": str(sh.id),
        "load_id": str(lo.id),
        "route": f"{lo.pickup_location} → {lo.dropoff_location}",
        "status": str(sh.status),
        "delivery_method": sh.delivery_method,
        "delivery_location_name": sh.delivery_location_name,
        "delivery_latitude": sh.delivery_latitude,
        "delivery_longitude": sh.delivery_longitude,
        "timestamps": {
            "created_at": sh.created_at.isoformat() if sh.created_at else None,
            "delivered_at": sh.delivered_at.isoformat() if sh.delivered_at else None,
            "auto_delivered_at": sh.auto_delivered_at.isoformat() if sh.auto_delivered_at else None,
            "payment_confirmed_at": sh.payment_confirmed_at.isoformat() if sh.payment_confirmed_at else None,
            "dispute_opened_at": sh.dispute_opened_at.isoformat() if sh.dispute_opened_at else None,
        },
        "dispute": {
            "open": sh.dispute_open,
            "reason": sh.dispute_reason,
            "note": sh.dispute_note,
        },
        "delivery_photos": sh.delivery_photo_urls.split(",") if sh.delivery_photo_urls else [],
        "shipper_pod_urls": sh.shipper_pod_urls.split(",") if getattr(sh, "shipper_pod_urls", None) else [],
        "gps_trail": gps_trail,
        "gps_trail_count": len(gps_trail),
    }


@router.get("/shipments/overdue")
async def admin_list_overdue_shipments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    """Return active shipments that are past their delivery_date and driver has been silent 4+ hours."""
    from datetime import date, timezone as tz
    from sqlalchemy import or_

    now = datetime.now(timezone.utc)
    today_str = date.today().isoformat()
    silence_cutoff = now - timedelta(hours=4)

    # Alias User for driver
    from sqlalchemy.orm import aliased
    DriverUser = aliased(User, name="driver_user")
    ShipperUser = aliased(User, name="shipper_user")

    q = (
        select(Shipment, Load, ShipperUser, DriverUser, Truck)
        .join(Load, Load.id == Shipment.load_id)
        .join(ShipperUser, ShipperUser.id == Load.shipper_id)
        .outerjoin(DriverUser, DriverUser.id == Shipment.driver_id)
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
        .order_by(Load.delivery_date.asc())
    )

    rows = (await db.execute(q)).all()

    items = []
    for sh, lo, shipper, driver, tr in rows:
        try:
            days_overdue = (date.today() - date.fromisoformat(lo.delivery_date)).days
        except Exception:
            days_overdue = 0

        if tr and tr.last_seen_at:
            hours_silent = round((now - tr.last_seen_at).total_seconds() / 3600, 1)
        else:
            hours_silent = None

        items.append({
            "id": str(sh.id),
            "load_id": str(lo.id),
            "pickup_location": lo.pickup_location,
            "dropoff_location": lo.dropoff_location,
            "shipper_name": shipper.full_name if shipper else None,
            "driver_name": driver.full_name if driver else None,
            "driver_phone": driver.phone_number if driver else None,
            "status": str(sh.status),
            "delivery_date": lo.delivery_date,
            "days_overdue": days_overdue,
            "last_seen_at": tr.last_seen_at.isoformat() if tr and tr.last_seen_at else None,
            "hours_silent": hours_silent,
            "price_kes": float(lo.price_kes),
            "created_at": sh.created_at.isoformat() if sh.created_at else None,
        })

    return {"total": len(items), "items": items}


class ResolveDisputeRequest(BaseModel):
    note: str | None = Field(None, max_length=2000)


@router.patch("/shipments/{shipment_id}/resolve-dispute")
async def resolve_dispute(
    shipment_id: uuid.UUID,
    body: ResolveDisputeRequest = ResolveDisputeRequest(),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    shipment = (await db.execute(select(Shipment).where(Shipment.id == shipment_id))).scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    shipment.dispute_open = False
    if body.note:
        shipment.dispute_note = body.note
    await log_activity(db, action="dispute_resolved", actor=admin, resource_type="shipment", resource_id=shipment.id,
        summary=f"{admin.full_name} resolved dispute on shipment {shipment.id}",
        meta={"note": body.note})
    await db.commit()
    return {"id": str(shipment.id), "dispute_open": False}


# ── Transactions ──────────────────────────────────────────────────────────────


class WithdrawalApprovalRequest(BaseModel):
    provider: str = Field(default="manual", pattern="^(intasend|manual)$")
    manual_reference: str | None = None


class WithdrawalRejectRequest(BaseModel):
    reason: str | None = None


def _public_provider_metadata(metadata: dict | None) -> dict:
    if not metadata:
        return {}
    safe = dict(metadata)
    account_number = safe.get("account_number")
    if account_number:
        account_number = str(account_number)
        safe["account_number"] = f"{'*' * max(len(account_number) - 4, 0)}{account_number[-4:]}"
    return safe

@router.get("/transactions")
async def admin_list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    tx_type: str | None = Query(None, alias="type"),
    tx_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    q = select(Transaction, Wallet, User).join(Wallet, Wallet.id == Transaction.wallet_id).join(User, User.id == Wallet.user_id)
    if tx_type:
        q = q.where(Transaction.transaction_type == tx_type)
    if tx_status:
        q = q.where(Transaction.status == tx_status)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(Transaction.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(tx.id),
                "user_name": u.full_name,
                "user_email": u.email,
                "user_role": str(u.role),
                "transaction_type": str(tx.transaction_type),
                "amount_kes": float(tx.amount_kes),
                "amount": float(tx.amount_kes),
                "currency": w.currency,
                "status": str(tx.status),
                "reference": tx.reference,
                "provider": tx.provider,
                "provider_reference": tx.provider_reference,
                "provider_transaction_id": tx.provider_transaction_id,
                "provider_status": tx.provider_status,
                "provider_metadata": _public_provider_metadata(tx.provider_metadata),
                "description": tx.description,
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
            }
            for tx, w, u in rows
        ],
    }


@router.post("/transactions/{transaction_id}/approve-withdrawal")
async def admin_approve_withdrawal(
    transaction_id: uuid.UUID,
    body: WithdrawalApprovalRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    result = await payment_service.approve_withdrawal(
        transaction_id=transaction_id,
        db=db,
        provider=body.provider,
        manual_reference=body.manual_reference,
    )
    await log_activity(db, action="withdrawal_approved", actor=admin, resource_type="transaction",
        resource_id=transaction_id,
        summary=f"{admin.full_name} approved withdrawal {transaction_id} via {body.provider}")
    await db.commit()
    return result


@router.post("/transactions/{transaction_id}/reject-withdrawal")
async def admin_reject_withdrawal(
    transaction_id: uuid.UUID,
    body: WithdrawalRejectRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    result = await payment_service.reject_withdrawal(
        transaction_id=transaction_id,
        db=db,
        reason=body.reason if body else None,
    )
    await log_activity(db, action="withdrawal_rejected", actor=admin, resource_type="transaction",
        resource_id=transaction_id,
        summary=f"{admin.full_name} rejected withdrawal {transaction_id}",
        meta={"reason": body.reason if body else None})
    await db.commit()
    return result


# ── Trucks ────────────────────────────────────────────────────────────────────

@router.get("/trucks")
async def admin_list_trucks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    q = select(Truck, User).join(User, User.id == Truck.owner_id)
    total = await db.scalar(select(func.count()).select_from(Truck))
    rows = (await db.execute(
        q.order_by(Truck.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(tr.id),
                "owner_id": str(tr.owner_id),
                "owner_name": u.full_name,
                "owner_email": u.email,
                "registration_number": tr.registration_number,
                "truck_type": str(tr.truck_type),
                "capacity_tonnes": tr.capacity_tonnes,
                "make": tr.make,
                "model": tr.model,
                "year": tr.year,
                "is_active": tr.is_active,
                "is_driver_owned": tr.is_driver_owned,
                "current_latitude": tr.current_latitude,
                "current_longitude": tr.current_longitude,
                "is_verified": tr.is_verified,
                "inspection_status": tr.inspection_status.value if tr.inspection_status else None,
                "verification_score": tr.verification_score,
                "verification_notes": tr.verification_notes,
                "logbook_url": tr.logbook_url,
                "insurance_url": tr.insurance_url,
                "insurance_expiry": tr.insurance_expiry.isoformat() if tr.insurance_expiry else None,
                "ntsa_inspection_url": tr.ntsa_inspection_url,
                "ntsa_inspection_expiry": tr.ntsa_inspection_expiry.isoformat() if tr.ntsa_inspection_expiry else None,
                "created_at": tr.created_at.isoformat() if tr.created_at else None,
            }
            for tr, u in rows
        ],
    }


@router.get("/trucks/{truck_id}")
async def admin_get_truck(
    truck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    row = (await db.execute(
        select(Truck, User).join(User, User.id == Truck.owner_id).where(Truck.id == truck_id)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Truck not found")
    tr, u = row
    return {
        "id": str(tr.id),
        "owner_id": str(tr.owner_id),
        "owner_name": u.full_name,
        "owner_email": u.email,
        "owner_phone": u.phone,
        "registration_number": tr.registration_number,
        "truck_type": str(tr.truck_type),
        "capacity_tonnes": tr.capacity_tonnes,
        "make": tr.make,
        "model": tr.model,
        "year": tr.year,
        "is_active": tr.is_active,
        "is_driver_owned": tr.is_driver_owned,
        "is_verified": tr.is_verified,
        "inspection_status": tr.inspection_status.value if tr.inspection_status else None,
        "verification_score": tr.verification_score,
        "verification_notes": tr.verification_notes,
        "logbook_url": tr.logbook_url,
        "insurance_url": tr.insurance_url,
        "insurance_expiry": tr.insurance_expiry.isoformat() if tr.insurance_expiry else None,
        "ntsa_inspection_url": tr.ntsa_inspection_url,
        "ntsa_inspection_expiry": tr.ntsa_inspection_expiry.isoformat() if tr.ntsa_inspection_expiry else None,
        "reg_check_status": tr.reg_check_status,
        "reg_check_detail": tr.reg_check_detail,
        "reg_check_owner": tr.reg_check_owner,
        "reg_check_at": tr.reg_check_at.isoformat() if tr.reg_check_at else None,
        "created_at": tr.created_at.isoformat() if tr.created_at else None,
    }


@router.patch("/trucks/{truck_id}/toggle-active")
async def toggle_truck_active(
    truck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    truck = (await db.execute(select(Truck).where(Truck.id == truck_id))).scalar_one_or_none()
    if not truck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Truck not found")
    truck.is_active = not truck.is_active
    action = "truck_activated" if truck.is_active else "truck_deactivated"
    await log_activity(db, action=action, actor=admin, resource_type="truck", resource_id=truck.id,
        summary=f"{admin.full_name} {'activated' if truck.is_active else 'deactivated'} truck {truck.registration_number}")
    await db.commit()
    return {"id": str(truck.id), "is_active": truck.is_active}


@router.patch("/trucks/{truck_id}/verify")
async def verify_truck(
    truck_id: uuid.UUID,
    body: AdminTruckVerifyAction,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    """Admin approves or rejects a truck after reviewing submitted compliance documents."""
    truck = (await db.execute(select(Truck).where(Truck.id == truck_id))).scalar_one_or_none()
    if not truck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Truck not found")

    if body.action == "approve":
        truck.is_verified = True
        truck.verified_at = datetime.now(timezone.utc)
        truck.inspection_status = InspectionStatus.approved
        if body.verification_score is not None:
            truck.verification_score = body.verification_score
        truck.verification_notes = None  # clear any previous rejection notes
        action = "truck_verified"
        notif_body = (
            f"Your truck {truck.registration_number} has been verified and is now visible "
            "to shippers on the marketplace."
        )
    else:
        if not body.rejection_reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="rejection_reason is required when rejecting a truck",
            )
        truck.is_verified = False
        truck.inspection_status = InspectionStatus.rejected
        truck.verification_notes = body.rejection_reason
        action = "truck_rejected"
        notif_body = (
            f"Your truck {truck.registration_number} verification was not approved. "
            f"Reason: {body.rejection_reason}. Please resubmit corrected documents."
        )

    await log_activity(
        db, action=action, actor=admin,
        resource_type="truck", resource_id=truck.id,
        summary=f"{admin.full_name} {action.replace('_', ' ')} {truck.registration_number}",
    )

    # Notify truck owner
    await notification_service.send_notification(
        user_id=truck.owner_id,
        notification_type=NotificationType.system,
        title="Truck Verification Update",
        body=notif_body,
        reference_id=truck.id,
        reference_type="truck",
        db=db,
    )

    await db.commit()
    await db.refresh(truck)
    return {
        "id": str(truck.id),
        "registration_number": truck.registration_number,
        "is_verified": truck.is_verified,
        "inspection_status": truck.inspection_status.value,
        "verification_notes": truck.verification_notes,
    }


@router.post("/trucks/{truck_id}/retrigger-check", status_code=202)
async def retrigger_truck_plate_check(
    truck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, str]:
    """Admin manually re-triggers the NTSA vehicle registration plate check via YourVerify."""
    truck = (await db.execute(select(Truck).where(Truck.id == truck_id))).scalar_one_or_none()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    plate = truck.registration_number

    async def _check() -> None:
        from app.database import AsyncSessionLocal
        from app.repositories.truck_repo import TruckRepository
        async with AsyncSessionLocal() as session:
            repo = TruckRepository(session)
            t = await repo.get_by_id(truck_id)
            if not t:
                return
            await repo.update(t, reg_check_status="pending")
            passed, owner_name, detail = await ntsa_verify_plate(plate)
            await repo.update(
                t,
                reg_check_status="passed" if passed else "failed",
                reg_check_at=datetime.now(timezone.utc),
                reg_check_detail=detail,
                reg_check_owner=owner_name,
            )

    asyncio.ensure_future(_check())
    return {"status": "check_started"}


# ── Fleet Map ────────────────────────────────────────────────────────────────

@router.get("/fleet/active-positions")
async def get_active_fleet_positions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> list[dict[str, Any]]:
    """All trucks with active shipments — used by the admin fleet map."""
    active_statuses = [
        LoadStatus.en_route_pickup,
        LoadStatus.loaded,
        LoadStatus.in_transit,
    ]
    rows = (await db.execute(
        select(Shipment, Truck, Load)
        .join(Truck, Truck.id == Shipment.truck_id)
        .join(Load, Load.id == Shipment.load_id)
        .where(
            Shipment.status.in_(active_statuses),
            Truck.current_latitude.isnot(None),
            Truck.current_longitude.isnot(None),
        )
    )).all()

    return [
        {
            "truck_id": str(truck.id),
            "registration_number": truck.registration_number,
            "truck_type": truck.truck_type.value if truck.truck_type else None,
            "shipment_id": str(shipment.id),
            "status": shipment.status.value if shipment.status else None,
            "current_latitude": truck.current_latitude,
            "current_longitude": truck.current_longitude,
            "last_seen_at": truck.last_seen_at.isoformat() if truck.last_seen_at else None,
            "battery_level": truck.battery_level,
            "signal_strength": truck.signal_strength,
            "pickup_location": load.pickup_location,
            "dropoff_location": load.dropoff_location,
            "cargo_type": load.cargo_type if hasattr(load, "cargo_type") else None,
            "eta": shipment.eta.isoformat() if shipment.eta else None,
        }
        for shipment, truck, load in rows
    ]


# ── Admin User Management (super_admin only) ─────────────────────────────────

class AdminCreatePayload(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=10, max_length=20)
    admin_role: AdminRole


_ADMIN_ROLE_LABELS = {
    "super_admin": "Super Admin",
    "operations_admin": "Operations Admin",
    "field_inspector": "Field Inspector",
    "iot_technician": "IoT Technician",
    "compliance_officer": "Compliance Officer",
    "support_agent": "Support Agent",
}


class AdminRoleUpdatePayload(BaseModel):
    admin_role: AdminRole


@router.get("/admins")
async def list_admins(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    admin_role: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    q = select(User).where(User.role == UserRole.admin)
    if admin_role:
        try:
            q = q.where(User.admin_role == AdminRole(admin_role))
        except ValueError:
            pass
    if search:
        term = f"%{search}%"
        q = q.where(User.full_name.ilike(term) | User.email.ilike(term))

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(
        q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "phone": u.phone,
                "admin_role": u.admin_role.value if u.admin_role else None,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "job_title":         u.job_title,
                "bio":               u.bio,
                "profile_photo_url": u.profile_photo_url,
                "show_on_team_page": u.show_on_team_page,
            }
            for u in rows
        ],
    }


@router.post("/admins", status_code=status.HTTP_201_CREATED)
async def create_admin(
    payload: AdminCreatePayload,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    role_label = _ADMIN_ROLE_LABELS.get(payload.admin_role.value, payload.admin_role.value)
    existing = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()

    if existing:
        if existing.role == UserRole.admin:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already an admin")
        existing.original_role = existing.role
        existing.role = UserRole.admin
        existing.admin_role = payload.admin_role
        existing.is_verified = True
        await log_activity(db, action="admin_created", actor=admin, resource_type="user", resource_id=existing.id,
            summary=f"{admin.full_name} promoted {existing.full_name} to {role_label}")
        await db.commit()
        await db.refresh(existing)
        asyncio.create_task(
            email_service.send_admin_appointment_email(existing.email, existing.full_name, role_label)
        )
        user = existing
    else:
        temp_password = secrets.token_urlsafe(10)
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            phone=payload.phone,
            hashed_password=hash_password(temp_password),
            role=UserRole.admin,
            admin_role=payload.admin_role,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await log_activity(db, action="admin_created", actor=admin, resource_type="user",
            summary=f"{admin.full_name} created new admin account for {payload.email} as {role_label}")
        await db.commit()
        await db.refresh(user)
        asyncio.create_task(
            email_service.send_admin_credentials_email(user.email, user.full_name, role_label, temp_password)
        )

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "admin_role": user.admin_role.value,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.patch("/admins/{user_id}/role")
async def update_admin_role(
    user_id: uuid.UUID,
    payload: AdminRoleUpdatePayload,
    db: AsyncSession = Depends(get_db),
    caller: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    if target.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not an admin")
    if str(target.id) == str(caller.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role")

    target.admin_role = payload.admin_role
    await log_activity(db, action="admin_role_changed", actor=caller, resource_type="user", resource_id=target.id,
        summary=f"{caller.full_name} changed {target.full_name}'s role to {payload.admin_role.value}")
    await db.commit()
    return {"id": str(target.id), "admin_role": target.admin_role.value}


@router.patch("/admins/{user_id}/suspend")
async def suspend_admin(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    caller: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    if target.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not an admin")
    if str(target.id) == str(caller.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot suspend yourself")

    target.is_active = not target.is_active
    action = "admin_unsuspended" if target.is_active else "admin_suspended"
    await log_activity(db, action=action, actor=caller, resource_type="user", resource_id=target.id,
        summary=f"{caller.full_name} {'reactivated' if target.is_active else 'suspended'} admin {target.full_name}")
    await db.commit()
    return {"id": str(target.id), "is_active": target.is_active}


@router.delete("/admins/{user_id}/revoke")
async def revoke_admin_access(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    caller: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    """Demote an admin back to a regular shipper account and clear their admin_role."""
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    if target.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not an admin")
    if str(target.id) == str(caller.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot revoke your own access")

    reverted_to = target.original_role or UserRole.shipper
    target.role = reverted_to
    target.admin_role = None
    target.original_role = None
    # Mark all existing notifications as admin-context so they're hidden after revocation
    await db.execute(
        update(Notification)
        .where(Notification.user_id == target.id)
        .values(is_admin_notification=True)
    )
    await log_activity(db, action="admin_revoked", actor=caller, resource_type="user", resource_id=target.id,
        summary=f"{caller.full_name} revoked admin access for {target.full_name} (reverted to {reverted_to.value})")
    await db.commit()
    return {"id": str(target.id), "role": reverted_to.value, "admin_role": None}


# ── Activity Log ──────────────────────────────────────────────────────────────

@router.get("/activity-log")
async def get_activity_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str | None = None,
    resource_type: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    allowed = ACTIVITY_VISIBLE_ACTIONS.get(admin.admin_role)
    if allowed is not None and len(allowed) == 0:
        return {"items": [], "total": 0, "page": page}

    q = select(ActivityLog).order_by(ActivityLog.created_at.desc())
    if allowed is not None:
        q = q.where(ActivityLog.action.in_(allowed))
    if action:
        q = q.where(ActivityLog.action == action)
    if resource_type:
        q = q.where(ActivityLog.resource_type == resource_type)
    if from_date:
        q = q.where(ActivityLog.created_at >= from_date)
    if to_date:
        q = q.where(ActivityLog.created_at <= to_date)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "items": [
            {
                "id": str(item.id),
                "actor_name": item.actor_name,
                "actor_role": item.actor_role,
                "action": item.action,
                "resource_type": item.resource_type,
                "resource_id": item.resource_id,
                "summary": item.summary,
                "meta": item.meta,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
    }


# ── User detail endpoints ─────────────────────────────────────────────────────

@router.get("/users/{user_id}/transactions")
async def admin_user_transactions(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    wallet = (await db.execute(select(Wallet).where(Wallet.user_id == user_id))).scalar_one_or_none()
    if not wallet:
        return {"total": 0, "page": page, "items": []}
    q = select(Transaction).where(Transaction.wallet_id == wallet.id).order_by(Transaction.created_at.desc())
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    txs = (await db.execute(q.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "items": [
            {
                "id": str(tx.id),
                "transaction_type": str(tx.transaction_type),
                "amount_kes": float(tx.amount_kes),
                "status": str(tx.status),
                "reference": tx.reference,
                "description": tx.description,
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
            }
            for tx in txs
        ],
    }


@router.get("/users/{user_id}/activity")
async def admin_user_activity(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    q = select(ActivityLog).where(ActivityLog.resource_id == str(user_id)).order_by(ActivityLog.created_at.desc())
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.execute(q.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "items": [
            {
                "id": str(item.id),
                "actor_name": item.actor_name,
                "action": item.action,
                "summary": item.summary,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
    }


# ── Admin: Multimodal Booking Visibility ─────────────────────────────────

from app.models.airfreight import Airfreight  # noqa: E402
from app.models.move_request import MoveRequest  # noqa: E402
from app.models.parcel import Parcel  # noqa: E402
from app.models.provider_profile import AirFreightProfile, MoverProfile, ParcelCarrierProfile  # noqa: E402


@router.get("/parcels", dependencies=[Depends(require_admin_role(AdminRole.operations_admin))])
async def admin_list_parcels(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = (
        select(Parcel)
        .order_by(Parcel.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "items": [
            {
                "id": str(r.id),
                "shipper_id": str(r.shipper_id),
                "pickup_location": r.pickup_location,
                "dropoff_location": r.dropoff_location,
                "weight_kg": r.weight_kg,
                "service_level": r.service_level.value if hasattr(r.service_level, "value") else r.service_level,
                "price_kes": r.price_kes,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "page": page,
    }


@router.get("/move-requests", dependencies=[Depends(require_admin_role(AdminRole.operations_admin))])
async def admin_list_move_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = (
        select(MoveRequest)
        .order_by(MoveRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "items": [
            {
                "id": str(r.id),
                "shipper_id": str(r.shipper_id),
                "move_type": r.move_type,
                "origin_location": r.origin_location,
                "destination_location": r.destination_location,
                "move_date": r.move_date,
                "price_kes": r.price_kes,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "page": page,
    }


@router.get("/airfreight", dependencies=[Depends(require_admin_role(AdminRole.operations_admin))])
async def admin_list_airfreight(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = (
        select(Airfreight)
        .order_by(Airfreight.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "items": [
            {
                "id": str(r.id),
                "shipper_id": str(r.shipper_id),
                "port_of_origin": r.port_of_origin,
                "port_of_destination": r.port_of_destination,
                "cargo_weight_kg": r.cargo_weight_kg,
                "price_kes": r.price_kes,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "page": page,
    }


# ── Admin: Service Provider Management ───────────────────────────────────────

_PROVIDER_PROFILE_MAP = {
    "mover":          (UserRole.mover,          MoverProfile),
    "air_freight":    (UserRole.air_freight,     AirFreightProfile),
    "parcel_carrier": (UserRole.parcel_carrier,  ParcelCarrierProfile),
}


@router.get("/providers")
async def admin_list_providers(
    role: str = Query(..., description="mover | air_freight | parcel_carrier"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin_role(AdminRole.super_admin, AdminRole.operations_admin)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if role not in _PROVIDER_PROFILE_MAP:
        raise HTTPException(status_code=400, detail="Invalid role. Use mover, air_freight, or parcel_carrier")
    user_role, ProfileModel = _PROVIDER_PROFILE_MAP[role]

    # Use the underlying Table object (not the ORM model) to avoid the inherited
    # `id` column from Base conflicting with these profiles that use `user_id` as PK.
    profile_tbl = ProfileModel.__table__
    # Exclude `id` too — provider profile tables use `user_id` as PK (no `id` column in the DB)
    excluded_cols = {"id", "user_id", "created_at", "updated_at"}
    profile_col_names = [c.name for c in profile_tbl.c if c.name not in excluded_cols]
    labeled_cols = [profile_tbl.c[name].label(f"p_{name}") for name in profile_col_names]

    stmt = (
        select(User, *labeled_cols)
        .join(profile_tbl, profile_tbl.c.user_id == User.id, isouter=True)
        .where(User.role == user_role)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    count_stmt = select(func.count()).select_from(User).where(User.role == user_role)
    total = (await db.execute(count_stmt)).scalar() or 0

    items = []
    for row in rows:
        user_row = row[0]
        profile_data = {}
        for i, col_name in enumerate(profile_col_names):
            val = row[i + 1]
            if hasattr(val, "isoformat"):
                val = val.isoformat()
            profile_data[col_name] = val
        items.append({
            "id": str(user_row.id),
            "full_name": user_row.full_name,
            "company_name": user_row.company_name,
            "email": user_row.email,
            "phone": user_row.phone,
            "country": user_row.country,
            "is_active": user_row.is_active,
            "created_at": user_row.created_at.isoformat() if user_row.created_at else None,
            **profile_data,
        })
    return {"items": items, "total": total, "page": page}


@router.patch("/providers/{user_id}/verify")
async def admin_verify_provider(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.super_admin, AdminRole.operations_admin)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or user.role.value not in _PROVIDER_PROFILE_MAP:
        raise HTTPException(status_code=404, detail="Provider not found")
    _, ProfileModel = _PROVIDER_PROFILE_MAP[user.role.value]
    profile = (await db.execute(select(ProfileModel).where(ProfileModel.user_id == user_id))).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    profile.is_verified = True
    profile.verified_at = datetime.now(timezone.utc)
    await notification_service.send_notification(
        user_id=user.id,
        notification_type=NotificationType.system,
        title="Account Verified",
        body="Your service provider account has been verified. You can now accept bookings.",
        db=db,
    )
    await log_activity(db, action="provider_verified", actor=admin, resource_type="user", resource_id=user.id,
                       summary=f"Admin verified provider {user.full_name} ({user.role.value})")
    await db.commit()
    return {"verified": True}


@router.patch("/providers/{user_id}/unverify")
async def admin_unverify_provider(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.super_admin, AdminRole.operations_admin)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or user.role.value not in _PROVIDER_PROFILE_MAP:
        raise HTTPException(status_code=404, detail="Provider not found")
    _, ProfileModel = _PROVIDER_PROFILE_MAP[user.role.value]
    profile = (await db.execute(select(ProfileModel).where(ProfileModel.user_id == user_id))).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    profile.is_verified = False
    profile.verified_at = None
    await log_activity(db, action="provider_unverified", actor=admin, resource_type="user", resource_id=user.id,
                       summary=f"Admin unverified provider {user.full_name} ({user.role.value})")
    await db.commit()
    return {"verified": False}


# ── Settings: Country Config (super_admin only) ───────────────────────────────

class CountryConfigOut(BaseModel):
    id: uuid.UUID
    country_code: str
    country_name: str
    currency_code: str
    currency_symbol: str
    vat_rate: float
    distance_unit: str
    date_format: str
    phone_prefix: str
    is_active: bool
    model_config = {"from_attributes": True}


class CountryConfigCreate(BaseModel):
    country_code: str
    country_name: str
    currency_code: str = "KES"
    currency_symbol: str = "KSh"
    vat_rate: float = 0.16
    distance_unit: str = "km"
    date_format: str = "DD/MM/YYYY"
    phone_prefix: str = "+254"
    is_active: bool = True


class CountryConfigUpdate(BaseModel):
    country_name: str | None = None
    currency_code: str | None = None
    currency_symbol: str | None = None
    vat_rate: float | None = None
    distance_unit: str | None = None
    date_format: str | None = None
    phone_prefix: str | None = None
    is_active: bool | None = None


@router.get("/settings/countries")
async def list_country_configs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> list[dict]:
    rows = (await db.execute(
        select(CountryConfig).order_by(CountryConfig.country_code)
    )).scalars().all()
    return [CountryConfigOut.model_validate(r).model_dump() for r in rows]


@router.post("/settings/countries", status_code=status.HTTP_201_CREATED)
async def create_country_config(
    payload: CountryConfigCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict:
    existing = (await db.execute(
        select(CountryConfig).where(CountryConfig.country_code == payload.country_code.upper())
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Country config already exists")
    row = CountryConfig(**{**payload.model_dump(), "country_code": payload.country_code.upper()})
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return CountryConfigOut.model_validate(row).model_dump()


@router.put("/settings/countries/{country_code}")
async def update_country_config(
    country_code: str,
    payload: CountryConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict:
    row = (await db.execute(
        select(CountryConfig).where(CountryConfig.country_code == country_code.upper())
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Country config not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return CountryConfigOut.model_validate(row).model_dump()


@router.delete("/settings/countries/{country_code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_country_config(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
):
    row = (await db.execute(
        select(CountryConfig).where(CountryConfig.country_code == country_code.upper())
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Country config not found")
    await db.delete(row)
    await db.commit()


# ── Settings: Platform Fees (super_admin only) ────────────────────────────────

class PlatformFeeOut(BaseModel):
    id: uuid.UUID
    country_code: str
    service_type: str
    commission_rate: float
    shipper_commission_rate: float | None
    carrier_commission_rate: float | None
    cancellation_fee_rate: float | None
    vat_rate: float
    min_commission_kes: float
    max_commission_kes: float | None
    is_active: bool
    notes: str | None
    model_config = {"from_attributes": True}


class PlatformFeeCreate(BaseModel):
    country_code: str
    service_type: str
    commission_rate: float = 0.05
    shipper_commission_rate: float | None = None
    carrier_commission_rate: float | None = None
    cancellation_fee_rate: float | None = None
    vat_rate: float = 0.16
    min_commission_kes: float = 500.0
    max_commission_kes: float | None = None
    is_active: bool = True
    notes: str | None = None


class PlatformFeeUpdate(BaseModel):
    commission_rate: float | None = None
    shipper_commission_rate: float | None = None
    carrier_commission_rate: float | None = None
    cancellation_fee_rate: float | None = None
    vat_rate: float | None = None
    min_commission_kes: float | None = None
    max_commission_kes: float | None = None
    is_active: bool | None = None
    notes: str | None = None


@router.get("/settings/platform-fees")
async def list_platform_fees(
    country_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> list[dict]:
    q = select(PlatformConfig).order_by(PlatformConfig.country_code, PlatformConfig.service_type)
    if country_code:
        q = q.where(PlatformConfig.country_code == country_code.upper())
    rows = (await db.execute(q)).scalars().all()
    return [PlatformFeeOut.model_validate(r).model_dump() for r in rows]


@router.post("/settings/platform-fees", status_code=status.HTTP_201_CREATED)
async def create_platform_fee(
    payload: PlatformFeeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict:
    row = PlatformConfig(**{**payload.model_dump(), "country_code": payload.country_code.upper()})
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return PlatformFeeOut.model_validate(row).model_dump()


@router.put("/settings/platform-fees/{config_id}")
async def update_platform_fee(
    config_id: uuid.UUID,
    payload: PlatformFeeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict:
    row = (await db.execute(
        select(PlatformConfig).where(PlatformConfig.id == config_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Platform fee config not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return PlatformFeeOut.model_validate(row).model_dump()


# ── Settings: Subscription Plans (super_admin only) ──────────────────────────

class SubscriptionPlanAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    tier: str
    billing_cycle: str
    price_kes: float
    max_trucks: int | None
    max_drivers: int | None
    max_loads_per_month: int | None
    includes_api_access: bool
    includes_analytics: bool
    includes_priority_matching: bool
    description: str | None
    is_active: bool
    target_role: str | None
    model_config = {"from_attributes": True}


class SubscriptionPlanUpdate(BaseModel):
    name: str | None = None
    price_kes: float | None = None
    max_trucks: int | None = None
    max_drivers: int | None = None
    max_loads_per_month: int | None = None
    includes_api_access: bool | None = None
    includes_analytics: bool | None = None
    includes_priority_matching: bool | None = None
    description: str | None = None
    is_active: bool | None = None
    target_role: str | None = None


@router.get("/settings/subscription-plans")
async def list_subscription_plans_admin(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> list[dict]:
    rows = (await db.execute(
        select(SubscriptionPlan).order_by(SubscriptionPlan.tier, SubscriptionPlan.billing_cycle)
    )).scalars().all()
    return [SubscriptionPlanAdminOut.model_validate(r).model_dump() for r in rows]


@router.put("/settings/subscription-plans/{plan_id}")
async def update_subscription_plan_admin(
    plan_id: uuid.UUID,
    payload: SubscriptionPlanUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict:
    row = (await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return SubscriptionPlanAdminOut.model_validate(row).model_dump()


# ── Company Profile (super_admin) ──────────────────────────────────────────────

class CompanyProfileUpdate(BaseModel):
    tagline:                  str | None  = None
    subtitle:                 str | None  = None
    hq_city:                  str | None  = None
    founded_year:             int | None  = None
    mission_headline:         str | None  = None
    mission_body:             str | None  = None
    show_stats_section:       bool | None = None
    show_testimonials_section: bool | None = None


@router.put("/settings/company-profile")
async def update_company_profile(
    payload: CompanyProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    """Super admin — update public company page content."""
    profile = await db.get(PlatformProfile, 1)
    if not profile:
        profile = PlatformProfile(id=1)
        db.add(profile)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(profile, k, v)
    await db.commit()
    return {"ok": True}


# ── Team Page Visibility ───────────────────────────────────────────────────────

class TeamVisibilityPayload(BaseModel):
    show_on_team_page: bool
    job_title:         str | None = None
    bio:               str | None = None
    admin_role:        AdminRole           # required — must specify a role
    profile_photo_url: str | None = None


@router.patch("/admins/{user_id}/team-visibility")
async def update_team_visibility(
    user_id: uuid.UUID,
    payload: TeamVisibilityPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_role(AdminRole.super_admin)),
) -> dict[str, Any]:
    """Super admin — update an admin's team page visibility, bio, job title, and role."""
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not an admin")

    target.show_on_team_page = payload.show_on_team_page
    target.admin_role        = payload.admin_role
    target.job_title         = payload.job_title   # null clears the field
    target.bio               = payload.bio         # null clears the field
    if payload.profile_photo_url is not None:
        target.profile_photo_url = payload.profile_photo_url
    await db.commit()
    return {
        "id":                str(target.id),
        "show_on_team_page": target.show_on_team_page,
        "job_title":         target.job_title,
        "bio":               target.bio,
        "admin_role":        target.admin_role,
        "profile_photo_url": target.profile_photo_url,
    }


# ── KRA / ETIMS Invoices ──────────────────────────────────────────────────────

@router.get("/etims")
async def admin_list_etims_invoices(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
) -> dict[str, Any]:
    count_q = select(func.count()).select_from(EtimsInvoice)
    total = await db.scalar(count_q)
    rows = (await db.execute(
        select(EtimsInvoice)
        .order_by(EtimsInvoice.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )).scalars().all()

    return {
        "total": total or 0,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": str(inv.id),
                "invoice_type": str(inv.invoice_type),
                "internal_invoice_no": inv.internal_invoice_no,
                "cu_invoice_no": inv.cu_invoice_no,
                "seller_pin": inv.seller_pin,
                "buyer_pin": inv.buyer_pin,
                "buyer_name": inv.buyer_name,
                "buyer_email": inv.buyer_email,
                "service_description": inv.service_description,
                "taxable_amount_kes": float(inv.taxable_amount_kes),
                "vat_amount_kes": float(inv.vat_amount_kes),
                "total_amount_kes": float(inv.total_amount_kes),
                "status": str(inv.status),
                "kra_submission_date": inv.kra_submission_date,
                "qr_code_url": inv.qr_code_url,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in rows
        ],
    }


# ---------------------------------------------------------------------------
# Payroll — employee salary, allowances, bonuses & Kenya tax deductions
# ---------------------------------------------------------------------------

from app.services.payroll_service import compute_deductions
from fastapi.responses import StreamingResponse
import csv
import io


def _payroll_row(r: EmployeeSalary, users_map: dict) -> dict:
    u = users_map.get(r.admin_user_id)
    return {
        "id": str(r.id),
        "admin_user_id": str(r.admin_user_id),
        "employee_name": u.full_name if u else "Unknown",
        "employee_email": u.email if u else None,
        "employee_pin": r.employee_pin,
        "admin_role": str(u.admin_role) if u and u.admin_role else None,
        "payment_month": r.payment_month,
        "base_salary_kes": float(r.base_salary_kes),
        "housing_allowance_kes": float(r.housing_allowance_kes),
        "transport_allowance_kes": float(r.transport_allowance_kes),
        "bonus_kes": float(r.bonus_kes),
        "bonus_reason": r.bonus_reason,
        "total_kes": float(r.total_kes),
        "paye_kes": float(r.paye_kes),
        "shif_kes": float(r.shif_kes),
        "nssf_kes": float(r.nssf_kes),
        "net_pay_kes": float(r.net_pay_kes),
        "status": str(r.status),
        "approved_by_id": str(r.approved_by_id) if r.approved_by_id else None,
        "paid_at": r.paid_at.isoformat() if r.paid_at else None,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class PayrollUpsertBody(BaseModel):
    admin_user_id: str
    payment_month: str  # "YYYY-MM"
    base_salary_kes: float = 0
    housing_allowance_kes: float = 0
    transport_allowance_kes: float = 0
    bonus_kes: float = 0
    bonus_reason: str | None = None
    employee_pin: str | None = None
    notes: str | None = None


@router.get("/payroll/admins")
async def list_payroll_admins(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(User)
        .where(User.role == UserRole.admin, User.is_active == True)
        .order_by(User.full_name)
    )).scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "admin_role": str(u.admin_role) if u.admin_role else None,
            "job_title": u.job_title,
        }
        for u in rows
    ]


@router.get("/payroll/itax-csv")
async def payroll_itax_csv(
    month: str = Query(..., description="YYYY-MM"),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Export monthly payroll as KRA iTax P10 compatible CSV."""
    rows = (await db.execute(
        select(EmployeeSalary).where(EmployeeSalary.payment_month == month)
    )).scalars().all()

    user_ids = [r.admin_user_id for r in rows]
    users_map: dict = {}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users_map = {u.id: u for u in users}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Employee Name", "Employee KRA PIN", "Gross Pay (KES)",
        "PAYE (KES)", "SHIF (KES)", "NSSF (KES)", "Net Pay (KES)",
        "Payment Month", "Status",
    ])
    for r in rows:
        u = users_map.get(r.admin_user_id)
        writer.writerow([
            u.full_name if u else "Unknown",
            r.employee_pin or "",
            float(r.total_kes),
            float(r.paye_kes),
            float(r.shif_kes),
            float(r.nssf_kes),
            float(r.net_pay_kes),
            r.payment_month,
            r.status,
        ])

    output.seek(0)
    filename = f"trakvora_payroll_{month}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/payroll/p9")
async def get_p9(
    user_id: str = Query(...),
    year: int = Query(...),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """P9 annual tax certificate for a single employee."""
    admin_uuid = uuid.UUID(user_id)
    rows = (await db.execute(
        select(EmployeeSalary)
        .where(
            EmployeeSalary.admin_user_id == admin_uuid,
            EmployeeSalary.payment_month.like(f"{year}-%"),
        )
        .order_by(EmployeeSalary.payment_month)
    )).scalars().all()

    employee = (await db.execute(select(User).where(User.id == admin_uuid))).scalar_one_or_none()

    months = [
        {
            "month": r.payment_month,
            "gross_kes": float(r.total_kes),
            "paye_kes": float(r.paye_kes),
            "shif_kes": float(r.shif_kes),
            "nssf_kes": float(r.nssf_kes),
            "net_pay_kes": float(r.net_pay_kes),
            "status": str(r.status),
        }
        for r in rows
    ]

    annual_gross = sum(m["gross_kes"] for m in months)
    annual_paye  = sum(m["paye_kes"]  for m in months)
    annual_shif  = sum(m["shif_kes"]  for m in months)
    annual_nssf  = sum(m["nssf_kes"]  for m in months)
    annual_net   = sum(m["net_pay_kes"] for m in months)

    return {
        "employee_name": employee.full_name if employee else "Unknown",
        "employee_email": employee.email if employee else None,
        "employee_pin": rows[0].employee_pin if rows else None,
        "year": year,
        "months": months,
        "annual": {
            "gross_kes": annual_gross,
            "paye_kes": annual_paye,
            "shif_kes": annual_shif,
            "nssf_kes": annual_nssf,
            "net_pay_kes": annual_net,
        },
    }


@router.get("/payroll")
async def list_payroll(
    month: str = Query(default=None),
    status: str = Query(default=None),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date
    if not month:
        month = date.today().strftime("%Y-%m")

    q = select(EmployeeSalary).where(EmployeeSalary.payment_month == month)
    if status:
        q = q.where(EmployeeSalary.status == status)
    rows = (await db.execute(q)).scalars().all()

    user_ids = [r.admin_user_id for r in rows]
    users_map: dict = {}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users_map = {u.id: u for u in users}

    return [_payroll_row(r, users_map) for r in rows]


@router.post("/payroll")
async def upsert_payroll(
    body: PayrollUpsertBody,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    admin_uuid = uuid.UUID(body.admin_user_id)
    gross = body.base_salary_kes + body.housing_allowance_kes + body.transport_allowance_kes + body.bonus_kes
    deductions = compute_deductions(gross)

    existing = (await db.execute(
        select(EmployeeSalary)
        .where(EmployeeSalary.admin_user_id == admin_uuid, EmployeeSalary.payment_month == body.payment_month)
    )).scalar_one_or_none()

    if existing:
        existing.base_salary_kes = body.base_salary_kes
        existing.housing_allowance_kes = body.housing_allowance_kes
        existing.transport_allowance_kes = body.transport_allowance_kes
        existing.bonus_kes = body.bonus_kes
        existing.bonus_reason = body.bonus_reason
        existing.total_kes = gross
        existing.paye_kes = deductions["paye_kes"]
        existing.shif_kes = deductions["shif_kes"]
        existing.nssf_kes = deductions["nssf_kes"]
        existing.net_pay_kes = deductions["net_pay_kes"]
        if body.employee_pin:
            existing.employee_pin = body.employee_pin
        existing.notes = body.notes
        record = existing
    else:
        record = EmployeeSalary(
            admin_user_id=admin_uuid,
            payment_month=body.payment_month,
            base_salary_kes=body.base_salary_kes,
            housing_allowance_kes=body.housing_allowance_kes,
            transport_allowance_kes=body.transport_allowance_kes,
            bonus_kes=body.bonus_kes,
            bonus_reason=body.bonus_reason,
            total_kes=gross,
            paye_kes=deductions["paye_kes"],
            shif_kes=deductions["shif_kes"],
            nssf_kes=deductions["nssf_kes"],
            net_pay_kes=deductions["net_pay_kes"],
            employee_pin=body.employee_pin,
            notes=body.notes,
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return {
        "id": str(record.id),
        "status": str(record.status),
        "total_kes": float(record.total_kes),
        "paye_kes": float(record.paye_kes),
        "shif_kes": float(record.shif_kes),
        "nssf_kes": float(record.nssf_kes),
        "net_pay_kes": float(record.net_pay_kes),
    }


@router.post("/payroll/{record_id}/approve")
async def approve_payroll(
    record_id: str,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    if current_user.admin_role != AdminRole.super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admins can approve payroll.")
    record = (await db.execute(select(EmployeeSalary).where(EmployeeSalary.id == uuid.UUID(record_id)))).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found.")
    record.status = PayrollStatus.approved
    record.approved_by_id = current_user.id
    await db.commit()
    return {"id": str(record.id), "status": str(record.status)}


@router.post("/payroll/{record_id}/mark-paid")
async def mark_payroll_paid(
    record_id: str,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    record = (await db.execute(select(EmployeeSalary).where(EmployeeSalary.id == uuid.UUID(record_id)))).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found.")
    record.status = PayrollStatus.paid
    record.paid_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(record.id), "status": str(record.status), "paid_at": record.paid_at.isoformat()}


# ── Commission management endpoints ──────────────────────────────────────────

def _commission_invoice_out(inv) -> dict:
    return {
        "id":             str(inv.id),
        "shipment_id":    str(inv.shipment_id),
        "owner_id":       str(inv.owner_id),
        "amount_kes":     float(inv.amount_kes),
        "rate_used":      inv.rate_used,
        "rate_pct":       round(inv.rate_used * 100, 2),
        "rate_breakdown": inv.rate_breakdown,
        "status":         inv.status,
        "due_at":         inv.due_at.isoformat() if inv.due_at else None,
        "paid_at":        inv.paid_at.isoformat() if inv.paid_at else None,
        "extended_until": inv.extended_until.isoformat() if inv.extended_until else None,
        "window_hours":   inv.window_hours,
        "auto_blocked":   inv.auto_blocked,
    }


@router.get("/commissions/summary")
async def admin_commission_summary(
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    overdue_kes = await db.scalar(
        select(func.sum(CommissionInvoice.amount_kes)).where(
            CommissionInvoice.status == CommissionInvoiceStatus.overdue
        )
    )
    blocked_count = await db.scalar(
        select(func.count(func.distinct(CommissionInvoice.owner_id))).where(
            CommissionInvoice.status == CommissionInvoiceStatus.overdue,
            CommissionInvoice.auto_blocked.is_(True),
        )
    )
    pending_kes = await db.scalar(
        select(func.sum(CommissionInvoice.amount_kes)).where(
            CommissionInvoice.status == CommissionInvoiceStatus.pending
        )
    )
    paid_kes = await db.scalar(
        select(func.sum(CommissionInvoice.amount_kes)).where(
            CommissionInvoice.status == CommissionInvoiceStatus.paid
        )
    )
    return {
        "total_overdue_kes":              float(overdue_kes or 0),
        "blocked_by_commission_count":    int(blocked_count or 0),
        "total_pending_kes":              float(pending_kes or 0),
        "total_paid_kes":                 float(paid_kes or 0),
    }


@router.get("/commissions")
async def admin_list_commissions(
    status_filter: str | None = Query(None, alias="status"),
    owner_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    q = select(CommissionInvoice)
    if status_filter:
        try:
            q = q.where(CommissionInvoice.status == CommissionInvoiceStatus(status_filter))
        except ValueError:
            raise HTTPException(400, f"Invalid status '{status_filter}'")
    if owner_id:
        q = q.where(CommissionInvoice.owner_id == owner_id)
    total = (await db.scalar(select(func.count()).select_from(q.subquery()))) or 0
    rows = (await db.execute(
        q.order_by(CommissionInvoice.due_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return {"items": [_commission_invoice_out(r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/commissions/{invoice_id}")
async def admin_get_commission(
    invoice_id: uuid.UUID,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.commission_invoice import CommissionInvoice
    inv = await db.get(CommissionInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Commission invoice not found")
    return _commission_invoice_out(inv)


class ExtendCommissionBody(BaseModel):
    extend_hours: int = Field(..., ge=1, le=720, description="Hours to extend from current due_at or extended_until")


@router.post("/commissions/{invoice_id}/extend")
async def admin_extend_commission(
    invoice_id: uuid.UUID,
    body: ExtendCommissionBody,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    inv = await db.get(CommissionInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Commission invoice not found")
    if inv.status in (CommissionInvoiceStatus.paid, CommissionInvoiceStatus.waived):
        raise HTTPException(400, f"Cannot extend a {inv.status} invoice")
    base = inv.extended_until or inv.due_at
    inv.extended_until = base + timedelta(hours=body.extend_hours)
    inv.status = CommissionInvoiceStatus.extended
    await db.commit()
    await log_activity(db, action="commission_extended", actor=admin, resource_type="commission_invoice",
                       resource_id=str(invoice_id), detail=f"Extended by {body.extend_hours}h")
    return {"extended_until": inv.extended_until.isoformat()}


@router.post("/commissions/{invoice_id}/waive")
async def admin_waive_commission(
    invoice_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.finance_admin, AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    from app.services.commission_service import unblock_if_cleared
    inv = await db.get(CommissionInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Commission invoice not found")
    if inv.status in (CommissionInvoiceStatus.paid, CommissionInvoiceStatus.waived):
        raise HTTPException(400, f"Cannot waive a {inv.status} invoice")
    inv.status       = CommissionInvoiceStatus.waived
    inv.waived_by_id = admin.id
    inv.auto_blocked = False
    await unblock_if_cleared(inv.owner_id, db)
    await db.commit()
    await log_activity(db, action="commission_waived", actor=admin, resource_type="commission_invoice",
                       resource_id=str(invoice_id))
    return {"status": "waived", "invoice_id": str(invoice_id)}


@router.post("/commissions/{invoice_id}/force-collect")
async def admin_force_collect_commission(
    invoice_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.finance_admin, AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    from app.services.commission_service import attempt_commission_payment, unblock_if_cleared
    inv = await db.get(CommissionInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Commission invoice not found")
    if inv.status in (CommissionInvoiceStatus.paid, CommissionInvoiceStatus.waived):
        raise HTTPException(400, f"Invoice is already {inv.status}")
    paid = await attempt_commission_payment(inv, db)
    if not paid:
        raise HTTPException(402, "Insufficient owner wallet balance to force-collect commission")
    await unblock_if_cleared(inv.owner_id, db)
    await db.commit()
    await log_activity(db, action="commission_force_collected", actor=admin, resource_type="commission_invoice",
                       resource_id=str(invoice_id))
    return {"status": "paid", "amount_kes": float(inv.amount_kes)}


@router.patch("/users/{user_id}/can-use-escrow")
async def admin_toggle_escrow_eligibility(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.finance_admin, AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    target.can_use_escrow = not target.can_use_escrow
    await db.commit()
    action = "escrow_enabled" if target.can_use_escrow else "escrow_disabled"
    await log_activity(db, action=action, actor=admin, resource_type="user", resource_id=str(user_id))
    return {"user_id": str(user_id), "can_use_escrow": target.can_use_escrow}


# ── Corridor rate management ──────────────────────────────────────────────────

class CorridorRateCreate(BaseModel):
    country_code:  str
    corridor_key:  str
    corridor_name: str
    base_rate:     float
    notes:         str | None = None

class CorridorRateUpdate(BaseModel):
    corridor_name: str | None = None
    base_rate:     float | None = None
    is_active:     bool | None = None
    notes:         str | None = None


@router.get("/corridor-rates")
async def admin_list_corridor_rates(
    country_code: str | None = None,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.corridor_rate import CorridorRate
    q = select(CorridorRate)
    if country_code:
        q = q.where(CorridorRate.country_code == country_code.upper())
    rows = (await db.execute(q.order_by(CorridorRate.country_code, CorridorRate.corridor_key))).scalars().all()
    return [
        {"id": str(r.id), "country_code": r.country_code, "corridor_key": r.corridor_key,
         "corridor_name": r.corridor_name, "base_rate": r.base_rate,
         "is_active": r.is_active, "notes": r.notes,
         "updated_at": r.updated_at.isoformat() if r.updated_at else None}
        for r in rows
    ]


@router.post("/corridor-rates", status_code=201)
async def admin_create_corridor_rate(
    body: CorridorRateCreate,
    admin: User = Depends(require_admin_role(AdminRole.super_admin, AdminRole.finance_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.corridor_rate import CorridorRate
    row = CorridorRate(
        country_code=body.country_code.upper(), corridor_key=body.corridor_key,
        corridor_name=body.corridor_name, base_rate=body.base_rate, notes=body.notes,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": str(row.id), "country_code": row.country_code, "corridor_key": row.corridor_key, "base_rate": row.base_rate}


@router.put("/corridor-rates/{rate_id}")
async def admin_update_corridor_rate(
    rate_id: uuid.UUID,
    body: CorridorRateUpdate,
    admin: User = Depends(require_admin_role(AdminRole.super_admin, AdminRole.finance_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.corridor_rate import CorridorRate
    row = await db.get(CorridorRate, rate_id)
    if not row:
        raise HTTPException(404, "Corridor rate not found")
    if body.corridor_name is not None: row.corridor_name = body.corridor_name
    if body.base_rate     is not None: row.base_rate     = body.base_rate
    if body.is_active     is not None: row.is_active     = body.is_active
    if body.notes         is not None: row.notes         = body.notes
    await db.commit()
    return {"id": str(row.id), "base_rate": row.base_rate, "is_active": row.is_active}


@router.delete("/corridor-rates/{rate_id}")
async def admin_deactivate_corridor_rate(
    rate_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.super_admin, AdminRole.finance_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.corridor_rate import CorridorRate
    row = await db.get(CorridorRate, rate_id)
    if not row:
        raise HTTPException(404, "Corridor rate not found")
    row.is_active = False
    await db.commit()
    return {"id": str(rate_id), "is_active": False}


@router.get("/fuel-index")
async def admin_get_fuel_index(
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.fuel_index import FuelIndex
    rows = (await db.execute(select(FuelIndex).order_by(FuelIndex.country_code))).scalars().all()
    return [
        {"id": str(r.id), "country_code": r.country_code, "baseline_price": r.baseline_price,
         "current_price": r.current_price, "currency_code": r.currency_code,
         "fuel_adjustment_factor": r.fuel_adjustment_factor,
         "last_fetched_at": r.last_fetched_at.isoformat() if r.last_fetched_at else None,
         "fetch_notes": r.fetch_notes}
        for r in rows
    ]


# ── Hero slide management ─────────────────────────────────────────────────────

class HeroSlideCreate(BaseModel):
    headline:            str
    highlight_word:      str
    description:         str
    image_type:          str = "dispatch_os"
    cta_primary_text:    str = "Get Started"
    cta_primary_url:     str = "/register"
    cta_secondary_text:  str | None = None
    cta_secondary_url:   str | None = None
    sort_order:          int = 0
    country_code:        str | None = None

class HeroSlideUpdate(BaseModel):
    headline:            str | None = None
    highlight_word:      str | None = None
    description:         str | None = None
    image_type:          str | None = None
    cta_primary_text:    str | None = None
    cta_primary_url:     str | None = None
    cta_secondary_text:  str | None = None
    cta_secondary_url:   str | None = None
    sort_order:          int | None = None
    is_active:           bool | None = None
    country_code:        str | None = None

class HeroSlideReorderItem(BaseModel):
    id:          uuid.UUID
    sort_order:  int

def _slide_out(s) -> dict:
    return {
        "id": str(s.id), "headline": s.headline, "highlight_word": s.highlight_word,
        "description": s.description, "image_type": s.image_type,
        "cta_primary_text": s.cta_primary_text, "cta_primary_url": s.cta_primary_url,
        "cta_secondary_text": s.cta_secondary_text, "cta_secondary_url": s.cta_secondary_url,
        "sort_order": s.sort_order, "is_active": s.is_active, "country_code": s.country_code,
    }


@router.get("/hero-slides")
async def admin_list_hero_slides(
    country_code: str | None = None,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.hero_slide import HeroSlide
    q = select(HeroSlide)
    if country_code is not None:
        from sqlalchemy import or_
        if country_code == "global":
            q = q.where(HeroSlide.country_code.is_(None))
        else:
            q = q.where(HeroSlide.country_code == country_code.upper())
    rows = (await db.execute(q.order_by(HeroSlide.sort_order))).scalars().all()
    return [_slide_out(r) for r in rows]


@router.post("/hero-slides", status_code=201)
async def admin_create_hero_slide(
    body: HeroSlideCreate,
    admin: User = Depends(require_admin_role(AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.hero_slide import HeroSlide
    slide = HeroSlide(**body.model_dump())
    db.add(slide)
    await db.commit()
    await db.refresh(slide)
    return _slide_out(slide)


@router.put("/hero-slides/{slide_id}")
async def admin_update_hero_slide(
    slide_id: uuid.UUID,
    body: HeroSlideUpdate,
    admin: User = Depends(require_admin_role(AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.hero_slide import HeroSlide
    slide = await db.get(HeroSlide, slide_id)
    if not slide:
        raise HTTPException(404, "Slide not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(slide, field, val)
    await db.commit()
    return _slide_out(slide)


@router.patch("/hero-slides/reorder")
async def admin_reorder_hero_slides(
    items: list[HeroSlideReorderItem],
    admin: User = Depends(require_admin_role(AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.hero_slide import HeroSlide
    for item in items:
        slide = await db.get(HeroSlide, item.id)
        if slide:
            slide.sort_order = item.sort_order
    await db.commit()
    return {"updated": len(items)}


@router.delete("/hero-slides/{slide_id}")
async def admin_delete_hero_slide(
    slide_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.hero_slide import HeroSlide
    slide = await db.get(HeroSlide, slide_id)
    if not slide:
        raise HTTPException(404, "Slide not found")
    await db.delete(slide)
    await db.commit()
    return {"deleted": str(slide_id)}


# ── Payment Methods (Finance Admin + Super Admin) ────────────────────────────

class PaymentMethodCreate(BaseModel):
    country_code: str
    method_id: str
    label: str
    type: str           # "mobile" | "bank"
    field: str          # "phone" | "account"
    bank_code: str | None = None
    mobile_bank: str | None = None
    icon: str | None = None
    is_active: bool = True
    sort_order: int = 0
    notes: str | None = None
    recipient_account: str | None = None  # trakvora's paybill/till/bank account
    recipient_name: str | None = None     # trakvora's account name


class PaymentMethodUpdate(BaseModel):
    label: str | None = None
    type: str | None = None
    field: str | None = None
    bank_code: str | None = None
    mobile_bank: str | None = None
    icon: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    notes: str | None = None
    recipient_account: str | None = None
    recipient_name: str | None = None


def _pm_out(pm) -> dict:
    return {
        "id": str(pm.id),
        "country_code": pm.country_code,
        "method_id": pm.method_id,
        "label": pm.label,
        "type": pm.type,
        "field": pm.field,
        "bank_code": pm.bank_code,
        "mobile_bank": pm.mobile_bank,
        "icon": pm.icon,
        "is_active": pm.is_active,
        "sort_order": pm.sort_order,
        "notes": pm.notes,
        "recipient_account": pm.recipient_account,
        "recipient_name": pm.recipient_name,
        "created_at": pm.created_at.isoformat() if pm.created_at else None,
        "updated_at": pm.updated_at.isoformat() if pm.updated_at else None,
    }


@router.get("/payment-methods")
async def admin_list_payment_methods(
    country_code: str | None = None,
    admin: User = Depends(require_admin_role(AdminRole.finance_admin, AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    from app.models.payment_method import PaymentMethod
    q = select(PaymentMethod).order_by(PaymentMethod.country_code, PaymentMethod.sort_order)
    if country_code:
        q = q.where(PaymentMethod.country_code == country_code.upper())
    rows = (await db.execute(q)).scalars().all()
    return [_pm_out(r) for r in rows]


@router.post("/payment-methods", status_code=201)
async def admin_create_payment_method(
    body: PaymentMethodCreate,
    admin: User = Depends(require_admin_role(AdminRole.finance_admin, AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.models.payment_method import PaymentMethod
    pm = PaymentMethod(
        country_code=body.country_code.upper(),
        method_id=body.method_id,
        label=body.label,
        type=body.type,
        field=body.field,
        bank_code=body.bank_code,
        mobile_bank=body.mobile_bank,
        icon=body.icon,
        is_active=body.is_active,
        sort_order=body.sort_order,
        notes=body.notes,
        recipient_account=body.recipient_account,
        recipient_name=body.recipient_name,
    )
    db.add(pm)
    try:
        await db.commit()
        await db.refresh(pm)
    except Exception:
        await db.rollback()
        raise HTTPException(409, "A method with that id already exists for this country")
    return _pm_out(pm)


@router.put("/payment-methods/{pm_id}")
async def admin_update_payment_method(
    pm_id: uuid.UUID,
    body: PaymentMethodUpdate,
    admin: User = Depends(require_admin_role(AdminRole.finance_admin, AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.models.payment_method import PaymentMethod
    pm = await db.get(PaymentMethod, pm_id)
    if not pm:
        raise HTTPException(404, "Payment method not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(pm, field, value)
    await db.commit()
    await db.refresh(pm)
    return _pm_out(pm)


@router.patch("/payment-methods/{pm_id}/toggle")
async def admin_toggle_payment_method(
    pm_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.finance_admin, AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.models.payment_method import PaymentMethod
    pm = await db.get(PaymentMethod, pm_id)
    if not pm:
        raise HTTPException(404, "Payment method not found")
    pm.is_active = not pm.is_active
    await db.commit()
    return {"id": str(pm.id), "is_active": pm.is_active}


@router.delete("/payment-methods/{pm_id}", status_code=204)
async def admin_delete_payment_method(
    pm_id: uuid.UUID,
    admin: User = Depends(require_admin_role(AdminRole.super_admin)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.payment_method import PaymentMethod
    pm = await db.get(PaymentMethod, pm_id)
    if not pm:
        raise HTTPException(404, "Payment method not found")
    await db.delete(pm)
    await db.commit()
