import asyncio
import secrets
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, text
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
from app.models.shipment import Shipment
from app.models.subscription import SubscriptionPlan
from app.models.truck import Truck
from app.models.user import AdminRole, KycStatus, User, UserRole
from app.models.vehicle_inspection import VehicleInspection
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.services import email_service, notification_service, payment_service
from app.services.activity_service import log_activity

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
                "role": str(u.role),
                "admin_role": u.admin_role.value if u.admin_role else None,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "kyc_status": u.kyc_status.value if u.kyc_status else "unverified",
                "kyc_rejection_reason": u.kyc_rejection_reason,
                "rating": u.rating,
                "total_trips": u.total_trips,
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

    total = await db.scalar(
        select(func.count()).select_from(Driver)
        .where(Driver.verification_status == verification_status if verification_status else True)
    )
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
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d, u in rows
        ],
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
    if new_status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    driver.verification_status = new_status
    driver.ntsa_verified = new_status == "approved"
    action = "driver_verified" if new_status == "approved" else ("driver_rejected" if new_status == "rejected" else "driver_pending")
    driver_user = (await db.execute(select(User).where(User.id == driver.user_id))).scalar_one_or_none()
    driver_name = driver_user.full_name if driver_user else str(driver.user_id)
    await log_activity(db, action=action, actor=admin, resource_type="driver", resource_id=driver.id,
        summary=f"{admin.full_name} set driver {driver_name} verification to {new_status}")
    if driver_user and new_status in ("approved", "rejected"):
        await notification_service.send_notification(
            user_id=driver_user.id,
            notification_type=NotificationType.system,
            title="Driver Verification Update",
            body="Congratulations! Your driver profile has been verified." if new_status == "approved"
                 else "Your driver verification was not approved. Please check your documents and re-submit.",
            db=db,
        )
    await db.commit()
    await db.refresh(driver)
    return {"id": str(driver.id), "verification_status": str(driver.verification_status), "ntsa_verified": driver.ntsa_verified}


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
        select(Shipment, Load, User)
        .join(Load, Load.id == Shipment.load_id)
        .join(User, User.id == Load.shipper_id)
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
            }
            for sh, lo, u in rows
        ],
    }


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
    provider: str = Field(default="flutterwave", pattern="^(flutterwave|manual)$")
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
                "created_at": tr.created_at.isoformat() if tr.created_at else None,
            }
            for tr, u in rows
        ],
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

    target.role = UserRole.shipper
    target.admin_role = None
    await log_activity(db, action="admin_revoked", actor=caller, resource_type="user", resource_id=target.id,
        summary=f"{caller.full_name} revoked admin access for {target.full_name} (demoted to shipper)")
    await db.commit()
    return {"id": str(target.id), "role": "shipper", "admin_role": None}


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

    stmt = (
        select(User, ProfileModel)
        .join(ProfileModel, ProfileModel.user_id == User.id, isouter=True)
        .where(User.role == user_role)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    count_stmt = select(User).where(User.role == user_role)
    total = len((await db.execute(count_stmt)).scalars().all())

    items = []
    for user_row, profile_row in rows:
        profile_cols = {c.name for c in ProfileModel.__table__.columns} - {"user_id", "created_at", "updated_at"}
        profile_data = {c: getattr(profile_row, c) for c in profile_cols} if profile_row else {}
        if profile_data.get("verified_at") and hasattr(profile_data.get("verified_at"), "isoformat"):
            profile_data["verified_at"] = profile_data["verified_at"].isoformat()
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
    includes_api_access: bool
    includes_analytics: bool
    includes_priority_matching: bool
    description: str | None
    is_active: bool
    model_config = {"from_attributes": True}


class SubscriptionPlanUpdate(BaseModel):
    name: str | None = None
    price_kes: float | None = None
    max_trucks: int | None = None
    max_drivers: int | None = None
    includes_api_access: bool | None = None
    includes_analytics: bool | None = None
    includes_priority_matching: bool | None = None
    description: str | None = None
    is_active: bool | None = None


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
