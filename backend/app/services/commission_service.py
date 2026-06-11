"""
Dynamic commission engine for Trakvora.

Layer 1 — calculate_commission(): pure function, no DB, fully testable.
Layer 2 — compute_and_create_invoice(): async, gathers DB context, persists invoice.
Layer 3 — attempt_commission_payment(): deducts from owner wallet, creates platform_fee tx.
           unblock_if_cleared(): re-enables user when all blocking invoices are resolved.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.commission_invoice import CommissionInvoice
    from app.models.load import Load
    from app.models.truck import Truck

logger = logging.getLogger(__name__)

# ── Fleet tier: more trucks → lower rate ────────────────────────────────────

def _fleet_tier(truck_count: int) -> tuple[float, str]:
    if truck_count >= 51: return 0.80, "51+ trucks"
    if truck_count >= 16: return 0.85, "16–50 trucks"
    if truck_count >= 6:  return 0.90, "6–15 trucks"
    if truck_count >= 2:  return 0.95, "2–5 trucks"
    return 1.00, "solo"

# ── Truck type ───────────────────────────────────────────────────────────────

_TRUCK_TYPE_MULT: dict[str, float] = {
    "flatbed":  1.00,
    "dry_van":  1.00,
    "tipper":   1.00,
    "van":      1.00,
    "pickup":   1.00,
    "motorcycle_courier": 1.00,
    "cargo_bike":         1.00,
    "reefer":   1.10,
    "tanker":   1.15,
    "lowbed":   1.20,
}

# ── Carrying capacity ────────────────────────────────────────────────────────

def _capacity_mult(tonnes: float) -> tuple[float, str]:
    if tonnes >= 30: return 1.15, "30t+"
    if tonnes >= 15: return 1.10, "15–30t"
    if tonnes >= 5:  return 1.05, "5–15t"
    return 1.00, "<5t"

# ── Cargo specialization ─────────────────────────────────────────────────────

_CARGO_MULT: dict[str, float] = {
    "general":      1.00,
    "agricultural": 1.00,
    "construction": 1.05,
    "livestock":    1.05,
    "refrigerated": 1.10,
    "electronics":  1.10,
    "hazardous":    1.20,
}

# ── Terrain difficulty ───────────────────────────────────────────────────────

_TERRAIN_MULT: dict[str, float] = {
    "standard": 1.00,
    "highland": 1.10,
    "rough":    1.20,
    "remote":   1.35,
}

# ── Distance ─────────────────────────────────────────────────────────────────

def _distance_mult(km: float | None) -> tuple[float, str]:
    if km is None:  return 1.00, "unknown"
    if km >= 500:   return 1.10, "500km+"
    if km >= 100:   return 1.05, "100–500km"
    return 1.00, "<100km"

# ── Payment mode ─────────────────────────────────────────────────────────────

_PAYMENT_MODE_MULT: dict[str, float] = {
    "direct": 1.00,
    "escrow": 1.30,
}

# ── Payment window ────────────────────────────────────────────────────────────

def _window_hours(truck_count: int) -> int:
    return 168 if truck_count >= 2 else 24


# ── Layer 1: Pure calculation ─────────────────────────────────────────────────

@dataclass
class CommissionCalculation:
    base_rate:      float
    effective_rate: float
    amount_kes:     float   # after min/max caps
    raw_amount_kes: float   # before caps
    window_hours:   int
    breakdown:      dict    # each factor with its multiplier for transparency


def calculate_commission(
    *,
    freight_amount_kes: float,
    base_rate: float,
    min_commission_kes: float,
    max_commission_kes: float | None,
    truck_count: int,
    truck_type: str,
    capacity_tonnes: float,
    cargo_type: str,
    terrain: str,
    distance_km: float | None,
    is_company_registered: bool,
    payment_mode: str,
) -> CommissionCalculation:
    fleet_mult,    fleet_label = _fleet_tier(truck_count)
    truck_mult                 = _TRUCK_TYPE_MULT.get(truck_type, 1.00)
    cap_mult,      cap_label   = _capacity_mult(capacity_tonnes)
    cargo_mult                 = _CARGO_MULT.get(cargo_type, 1.00)
    terrain_mult               = _TERRAIN_MULT.get(terrain, 1.00)
    dist_mult,     dist_label  = _distance_mult(distance_km)
    reg_mult                   = 0.95 if is_company_registered else 1.00
    mode_mult                  = _PAYMENT_MODE_MULT.get(payment_mode, 1.00)

    effective_rate = round(
        base_rate * fleet_mult * truck_mult * cap_mult
        * cargo_mult * terrain_mult * reg_mult * dist_mult * mode_mult,
        6,
    )

    raw_amount = round(freight_amount_kes * effective_rate, 2)
    capped = max(raw_amount, min_commission_kes)
    if max_commission_kes is not None:
        capped = min(capped, max_commission_kes)

    breakdown = {
        "base_rate":    {"value": base_rate},
        "fleet_tier":   {"multiplier": fleet_mult,    "label": fleet_label, "truck_count": truck_count},
        "truck_type":   {"multiplier": truck_mult,    "type": truck_type},
        "capacity":     {"multiplier": cap_mult,      "label": cap_label,   "tonnes": capacity_tonnes},
        "cargo_spec":   {"multiplier": cargo_mult,    "cargo_type": cargo_type},
        "terrain":      {"multiplier": terrain_mult,  "terrain": terrain},
        "registration": {"multiplier": reg_mult,      "is_company": is_company_registered},
        "distance":     {"multiplier": dist_mult,     "label": dist_label,  "km": distance_km},
        "payment_mode": {"multiplier": mode_mult,     "mode": payment_mode},
        "effective_rate": effective_rate,
        "raw_amount_kes": raw_amount,
        "capped_amount_kes": capped,
    }

    return CommissionCalculation(
        base_rate=base_rate,
        effective_rate=effective_rate,
        amount_kes=capped,
        raw_amount_kes=raw_amount,
        window_hours=_window_hours(truck_count),
        breakdown=breakdown,
    )


# ── Layer 2: Async orchestrator ───────────────────────────────────────────────

async def compute_and_create_invoice(
    *,
    shipment_id: uuid.UUID,
    owner_id: uuid.UUID,
    shipper_country: str,
    freight_amount_kes: float,
    truck: "Truck",
    load: "Load",
    payment_confirmed_at: datetime,
    db: AsyncSession,
) -> tuple["CommissionInvoice", CommissionCalculation]:
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    from app.models.company import Company
    from app.models.platform_config import PlatformConfig
    from app.models.truck import Truck as TruckModel
    from app.models.user import User as UserModel

    # Guard: return existing invoice if already created (idempotent)
    existing = (await db.execute(
        select(CommissionInvoice).where(CommissionInvoice.shipment_id == shipment_id)
    )).scalar_one_or_none()
    if existing:
        calc = calculate_commission(
            freight_amount_kes=freight_amount_kes,
            base_rate=float(existing.rate_breakdown.get("base_rate", {}).get("value", 0.08)),
            min_commission_kes=0,
            max_commission_kes=None,
            truck_count=existing.rate_breakdown.get("fleet_tier", {}).get("truck_count", 1),
            truck_type=existing.rate_breakdown.get("truck_type", {}).get("type", "flatbed"),
            capacity_tonnes=existing.rate_breakdown.get("capacity", {}).get("tonnes", 0),
            cargo_type=existing.rate_breakdown.get("cargo_spec", {}).get("cargo_type", "general"),
            terrain=existing.rate_breakdown.get("terrain", {}).get("terrain", "standard"),
            distance_km=existing.rate_breakdown.get("distance", {}).get("km"),
            is_company_registered=existing.rate_breakdown.get("registration", {}).get("is_company", False),
            payment_mode=existing.rate_breakdown.get("payment_mode", {}).get("mode", "direct"),
        )
        return existing, calc

    # 1. Platform config: base rate + caps
    pc = (await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.country_code == shipper_country,
            PlatformConfig.service_type == "truck",
            PlatformConfig.is_active.is_(True),
        )
    )).scalar_one_or_none()
    base_rate      = float(pc.carrier_commission_rate if pc and pc.carrier_commission_rate is not None else (pc.commission_rate if pc else 0.08))
    min_comm       = float(pc.min_commission_kes) if pc else 500.0
    max_comm       = float(pc.max_commission_kes) if pc and pc.max_commission_kes else None

    # 2. Fleet tier: count owner's active trucks
    truck_count = (await db.scalar(
        select(func.count()).select_from(TruckModel).where(
            TruckModel.owner_id == owner_id,
            TruckModel.is_active.is_(True),
        )
    )) or 1

    # 3. Company registration check
    owner_user = await db.get(UserModel, owner_id)
    has_company_name = bool(owner_user and owner_user.company_name)
    company_count = (await db.scalar(
        select(func.count()).select_from(Company).where(Company.owner_user_id == owner_id)
    )) or 0
    is_company = has_company_name or company_count > 0

    # 4. Pure calculation
    terrain = getattr(load.terrain_difficulty, "value", "standard") if hasattr(load, "terrain_difficulty") else "standard"
    mode    = getattr(load.payment_mode, "value", "direct") if hasattr(load, "payment_mode") else "direct"

    calc = calculate_commission(
        freight_amount_kes   = freight_amount_kes,
        base_rate            = base_rate,
        min_commission_kes   = min_comm,
        max_commission_kes   = max_comm,
        truck_count          = truck_count,
        truck_type           = truck.truck_type.value if hasattr(truck.truck_type, "value") else str(truck.truck_type),
        capacity_tonnes      = float(truck.capacity_tonnes or 0),
        cargo_type           = load.cargo_type.value if hasattr(load.cargo_type, "value") else str(load.cargo_type),
        terrain              = terrain,
        distance_km          = float(load.distance_km) if load.distance_km else None,
        is_company_registered= is_company,
        payment_mode         = mode,
    )

    # 5. Persist invoice
    due_at = payment_confirmed_at + timedelta(hours=calc.window_hours)
    invoice = CommissionInvoice(
        shipment_id    = shipment_id,
        owner_id       = owner_id,
        amount_kes     = calc.amount_kes,
        rate_used      = calc.effective_rate,
        rate_breakdown = calc.breakdown,
        status         = CommissionInvoiceStatus.pending,
        due_at         = due_at,
        window_hours   = calc.window_hours,
    )
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return invoice, calc


# ── Layer 3: Wallet deduction + auto-unblock ──────────────────────────────────

async def attempt_commission_payment(
    invoice: "CommissionInvoice",
    db: AsyncSession,
) -> bool:
    """
    Tries to deduct the commission from the owner's wallet.
    Returns True if paid, False if insufficient balance.
    Does NOT commit — caller is responsible.
    """
    from app.models.commission_invoice import CommissionInvoiceStatus
    from app.models.wallet import TransactionStatus, TransactionType
    from app.repositories.wallet_repo import WalletRepository
    from app.services import etims_service

    if invoice.status in (CommissionInvoiceStatus.paid, CommissionInvoiceStatus.waived):
        return True

    repo = WalletRepository(db)
    wallet = await repo.get_by_user(invoice.owner_id)
    if not wallet or float(wallet.balance_kes) < float(invoice.amount_kes):
        return False

    # Deduct commission from owner wallet
    await repo.update_balance(wallet, balance_delta=-float(invoice.amount_kes))
    fee_tx = await repo.create_transaction(
        wallet_id        = wallet.id,
        shipment_id      = invoice.shipment_id,
        transaction_type = TransactionType.platform_fee,
        amount_kes       = float(invoice.amount_kes),
        status           = TransactionStatus.completed,
        description      = f"Trakvora commission ({round(invoice.rate_used * 100, 2)}% effective rate)",
    )

    # eTIMS invoice for commission
    owner_user = await db.get(__import__("app.models.user", fromlist=["User"]).User, invoice.owner_id)
    if owner_user:
        try:
            await etims_service.process_and_store_invoice(fee_tx, owner_user, db)
        except Exception:
            logger.warning("eTIMS invoice failed for commission invoice %s", invoice.id)

    invoice.status  = CommissionInvoiceStatus.paid
    invoice.paid_at = datetime.now(timezone.utc)
    await db.flush()
    return True


async def unblock_if_cleared(owner_id: uuid.UUID, db: AsyncSession) -> bool:
    """
    Re-enables a user's account if all auto_blocked commission invoices are resolved.
    Only touches accounts that were suspended by the commission system (auto_blocked=True).
    Returns True if user was re-enabled.
    """
    from app.models.commission_invoice import CommissionInvoice, CommissionInvoiceStatus
    from app.models.user import User as UserModel

    remaining = (await db.scalar(
        select(func.count()).select_from(CommissionInvoice).where(
            CommissionInvoice.owner_id     == owner_id,
            CommissionInvoice.auto_blocked.is_(True),
            CommissionInvoice.status.in_([
                CommissionInvoiceStatus.pending,
                CommissionInvoiceStatus.overdue,
            ]),
        )
    )) or 0

    if remaining > 0:
        return False

    user = await db.get(UserModel, owner_id)
    if user and not user.is_active:
        # Only unblock if there are no non-commission reasons for suspension
        has_any_auto_blocked = (await db.scalar(
            select(func.count()).select_from(CommissionInvoice).where(
                CommissionInvoice.owner_id     == owner_id,
                CommissionInvoice.auto_blocked.is_(True),
            )
        )) or 0

        if has_any_auto_blocked > 0:
            user.is_active = True
            await db.flush()
            return True

    return False


async def get_owner_rate_preview(owner_id: uuid.UUID, db: AsyncSession) -> dict:
    """
    Returns a commission rate preview for the owner without persisting anything.
    Used by GET /commissions/my-rate endpoint.
    """
    from app.models.company import Company
    from app.models.platform_config import PlatformConfig
    from app.models.truck import Truck as TruckModel
    from app.models.user import User as UserModel

    owner_user = await db.get(UserModel, owner_id)
    country = (owner_user.country or "KE").upper() if owner_user else "KE"

    pc = (await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.country_code == country,
            PlatformConfig.service_type == "truck",
            PlatformConfig.is_active.is_(True),
        )
    )).scalar_one_or_none()
    base_rate = float(pc.carrier_commission_rate if pc and pc.carrier_commission_rate is not None else (pc.commission_rate if pc else 0.08))

    truck_count = (await db.scalar(
        select(func.count()).select_from(TruckModel).where(
            TruckModel.owner_id == owner_id,
            TruckModel.is_active.is_(True),
        )
    )) or 1

    has_company = bool(owner_user and owner_user.company_name) or (
        (await db.scalar(select(func.count()).select_from(Company).where(Company.owner_user_id == owner_id))) or 0
    ) > 0

    fleet_mult, fleet_label = _fleet_tier(truck_count)
    reg_mult = 0.95 if has_company else 1.00
    window = _window_hours(truck_count)

    return {
        "base_rate":         base_rate,
        "base_rate_pct":     round(base_rate * 100, 2),
        "fleet_tier":        {"multiplier": fleet_mult, "label": fleet_label, "truck_count": truck_count},
        "registration":      {"multiplier": reg_mult, "is_company": has_company},
        "payment_window_hours": window,
        "note": "Final rate also varies by truck type, cargo, terrain, and distance on each job.",
    }
