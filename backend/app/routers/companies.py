import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.company import Company, CompanyMember, CompanyMemberRole
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User, UserRole
from app.models.load import Load
from app.services import email_service

FRONTEND_BASE = getattr(settings, "frontend_url", "http://localhost:5173")

router = APIRouter(prefix="/companies", tags=["companies"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    kra_pin: str | None = None
    industry: str | None = None
    country_code: str = "KE"
    website: str | None = None
    description: str | None = None


class CompanyOut(BaseModel):
    id: uuid.UUID
    name: str
    kra_pin: str | None
    industry: str | None
    country_code: str
    logo_url: str | None
    website: str | None
    description: str | None
    is_verified: bool
    member_count: int = 0

    model_config = {"from_attributes": True}


class MemberInvite(BaseModel):
    email: str
    role: CompanyMemberRole = CompanyMemberRole.viewer


class MemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: CompanyMemberRole
    is_active: bool
    email: str | None = None
    full_name: str | None = None

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_company_or_403(company_id: uuid.UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(
        select(Company)
        .options(selectinload(Company.members))
        .where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    is_admin_member = any(
        m.user_id == user.id and m.role == CompanyMemberRole.admin and m.is_active
        for m in company.members
    )
    if company.owner_user_id != user.id and not is_admin_member and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorised for this company")
    return company


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("", response_model=CompanyOut, status_code=201)
async def create_company(
    body: CompanyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.shipper, UserRole.owner, UserRole.admin):
        raise HTTPException(status_code=403, detail="Only shippers and owners can create companies")

    company = Company(
        **body.model_dump(),
        owner_user_id=current_user.id,
    )
    db.add(company)
    await db.flush()

    # Owner is automatically an admin member
    db.add(CompanyMember(
        company_id=company.id,
        user_id=current_user.id,
        role=CompanyMemberRole.admin,
        invited_by=current_user.id,
    ))
    await db.commit()
    await db.refresh(company)
    return {**company.__dict__, "member_count": 1}


@router.get("", response_model=list[CompanyOut])
async def list_my_companies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Company)
        .join(CompanyMember, CompanyMember.company_id == Company.id)
        .where(CompanyMember.user_id == current_user.id, CompanyMember.is_active == True)
        .options(selectinload(Company.members))
    )
    companies = result.scalars().unique().all()
    return [
        {**c.__dict__, "member_count": len([m for m in c.members if m.is_active])}
        for c in companies
    ]


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company = await _get_company_or_403(company_id, current_user, db)
    return {**company.__dict__, "member_count": len([m for m in company.members if m.is_active])}


@router.post("/{company_id}/members", response_model=MemberOut, status_code=201)
async def invite_member(
    company_id: uuid.UUID,
    body: MemberInvite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company = await _get_company_or_403(company_id, current_user, db)

    # Look up target user by email
    result = await db.execute(select(User).where(User.email == body.email))
    target_user = result.scalar_one_or_none()

    if not target_user:
        # User not on platform yet — create an invite link and email it
        # Cancel any existing pending invite for same company + email
        old_inv_res = await db.execute(
            select(Invitation).where(
                Invitation.invitee_email == body.email,
                Invitation.company_id == company_id,
                Invitation.status == InvitationStatus.pending,
            )
        )
        for old in old_inv_res.scalars().all():
            old.status = InvitationStatus.cancelled

        from app.models.user import UserRole as UR
        invite = Invitation(
            inviter_id=current_user.id,
            invitee_email=body.email,
            role=UR.shipper,        # default role for company team members
            company_id=company_id,
        )
        invite.company_member_role = body.role.value  # admin / ops / viewer
        db.add(invite)
        await db.flush()

        invite_url = f"{FRONTEND_BASE}/register/invite/{invite.token}"
        await email_service.send_invitation_email(
            to_email=body.email,
            inviter_name=current_user.full_name,
            role="team member",
            company_name=company.name,
            invite_url=invite_url,
        )
        await db.commit()

        # Return a "pending" member placeholder so frontend can show it
        return {
            "id": invite.id,
            "user_id": None,
            "role": body.role,
            "is_active": False,
            "email": body.email,
            "full_name": None,
            "pending_invite": True,
        }

    # Prevent duplicates
    already = next((m for m in company.members if m.user_id == target_user.id), None)
    if already and already.is_active:
        raise HTTPException(status_code=409, detail="User is already a member")

    if already:
        already.is_active = True
        already.role = body.role
        await db.commit()
        await db.refresh(already)
        member = already
    else:
        member = CompanyMember(
            company_id=company.id,
            user_id=target_user.id,
            role=body.role,
            invited_by=current_user.id,
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)

    return {
        **member.__dict__,
        "email": target_user.email,
        "full_name": target_user.full_name,
    }


@router.get("/{company_id}/members", response_model=list[MemberOut])
async def list_members(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company = await _get_company_or_403(company_id, current_user, db)
    result = await db.execute(
        select(CompanyMember, User)
        .join(User, User.id == CompanyMember.user_id)
        .where(CompanyMember.company_id == company.id, CompanyMember.is_active == True)
    )
    rows = result.all()
    return [
        {**member.__dict__, "email": user.email, "full_name": user.full_name}
        for member, user in rows
    ]


@router.delete("/{company_id}/members/{user_id}", status_code=204)
async def remove_member(
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company = await _get_company_or_403(company_id, current_user, db)
    if user_id == company.owner_user_id:
        raise HTTPException(status_code=400, detail="Cannot remove the company owner")
    member = next((m for m in company.members if m.user_id == user_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.is_active = False
    await db.commit()


@router.get("/{company_id}/analytics")
async def company_analytics(
    company_id: uuid.UUID,
    period: int = Query(30, description="Days to look back (30, 90, 365)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.load import Load, LoadStatus
    from app.models.shipment import Shipment
    from datetime import timedelta

    company = await _get_company_or_403(company_id, current_user, db)

    member_ids_result = await db.execute(
        select(CompanyMember.user_id).where(
            CompanyMember.company_id == company.id,
            CompanyMember.is_active == True,
        )
    )
    member_ids = [r[0] for r in member_ids_result.all()]

    since = datetime.now(timezone.utc) - timedelta(days=period)

    # Loads in period
    loads_result = await db.execute(
        select(Load).where(
            Load.shipper_id.in_(member_ids),
            Load.created_at >= since,
        )
    )
    all_loads = loads_result.scalars().all()

    total_loads     = len(all_loads)
    delivered_loads = [l for l in all_loads if l.status == LoadStatus.delivered]
    cancelled_loads = [l for l in all_loads if l.status == LoadStatus.cancelled]
    total_value     = sum(float(l.price_kes or 0) for l in delivered_loads)

    # Corridor breakdown
    corridor_counts: dict[str, dict] = {}
    for l in delivered_loads:
        key = l.corridor or f"{l.pickup_location} → {l.dropoff_location}"
        if key not in corridor_counts:
            corridor_counts[key] = {"route": key, "trips": 0, "value_kes": 0.0}
        corridor_counts[key]["trips"] += 1
        corridor_counts[key]["value_kes"] += float(l.price_kes or 0)
    top_corridors = sorted(corridor_counts.values(), key=lambda x: x["trips"], reverse=True)[:5]

    # Cargo type breakdown
    cargo_counts: dict[str, dict] = {}
    for l in all_loads:
        ct = l.cargo_type or "general"
        if ct not in cargo_counts:
            cargo_counts[ct] = {"type": ct, "trips": 0, "value_kes": 0.0}
        cargo_counts[ct]["trips"] += 1
        cargo_counts[ct]["value_kes"] += float(l.price_kes or 0)
    cargo_breakdown = sorted(cargo_counts.values(), key=lambda x: x["trips"], reverse=True)

    # Top carriers (via Shipment)
    load_ids = [l.id for l in delivered_loads]
    carrier_stats: dict[uuid.UUID, dict] = {}
    if load_ids:
        shipments = (await db.execute(
            select(Shipment).where(Shipment.load_id.in_(load_ids))
            .options(selectinload(Shipment.load), selectinload(Shipment.owner))
        )).scalars().all()
        for s in shipments:
            oid = s.owner_id
            if oid not in carrier_stats:
                carrier_stats[oid] = {
                    "carrier_name": s.owner.full_name if s.owner else "Unknown",
                    "trips": 0,
                    "value_kes": 0.0,
                    "ratings": [],
                }
            carrier_stats[oid]["trips"] += 1
            if s.load:
                carrier_stats[oid]["value_kes"] += float(s.load.price_kes or 0)
            if s.carrier_rating:
                carrier_stats[oid]["ratings"].append(s.carrier_rating)

    top_carriers = []
    for v in sorted(carrier_stats.values(), key=lambda x: x["trips"], reverse=True)[:5]:
        avg = round(sum(v["ratings"]) / len(v["ratings"]), 1) if v["ratings"] else None
        top_carriers.append({
            "carrier_name": v["carrier_name"],
            "trips":        v["trips"],
            "avg_rating":   avg,
            "value_kes":    round(v["value_kes"], 2),
        })

    on_time_rate = round(len(delivered_loads) / total_loads * 100, 1) if total_loads else 0

    return {
        "company_id":                str(company.id),
        "company_name":              company.name,
        "member_count":              len(member_ids),
        "period_days":               period,
        "total_loads":               total_loads,
        "completed_loads":           len(delivered_loads),
        "cancelled_loads":           len(cancelled_loads),
        "total_transport_value_kes": round(total_value, 2),
        "on_time_delivery_rate_pct": on_time_rate,
        "top_corridors":             top_corridors,
        "cargo_type_breakdown":      cargo_breakdown,
        "top_carriers":              top_carriers,
    }


# ── Preferred Carrier Network ────────────────────────────────────────────────

class AddPreferredCarrierPayload(BaseModel):
    carrier_user_id: uuid.UUID


async def _assert_company_admin(company_id: uuid.UUID, current_user: User, db: AsyncSession) -> Company:
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if current_user.role == UserRole.admin:
        return company
    member = (await db.execute(
        select(CompanyMember).where(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id == current_user.id,
            CompanyMember.is_active == True,
        )
    )).scalar_one_or_none()
    if not member or member.role not in (CompanyMemberRole.owner, CompanyMemberRole.admin):
        raise HTTPException(status_code=403, detail="Company admin access required")
    return company


@router.get("/{company_id}/preferred-carriers")
async def list_preferred_carriers(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.preferred_carrier import CompanyPreferredCarrier
    await _assert_company_admin(company_id, current_user, db)

    rows = (await db.execute(
        select(CompanyPreferredCarrier, User)
        .join(User, User.id == CompanyPreferredCarrier.carrier_user_id)
        .where(CompanyPreferredCarrier.company_id == company_id)
        .order_by(CompanyPreferredCarrier.created_at.desc())
    )).all()

    return [
        {
            "id": str(r.CompanyPreferredCarrier.id),
            "carrier_user_id": str(r.CompanyPreferredCarrier.carrier_user_id),
            "carrier_name": r.User.full_name,
            "carrier_email": r.User.email,
            "carrier_phone": r.User.phone,
            "partner_tier": r.User.partner_tier.value if r.User.partner_tier else "standard",
            "added_at": r.CompanyPreferredCarrier.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/{company_id}/preferred-carriers", status_code=201)
async def add_preferred_carrier(
    company_id: uuid.UUID,
    payload: AddPreferredCarrierPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.preferred_carrier import CompanyPreferredCarrier
    await _assert_company_admin(company_id, current_user, db)

    carrier = (await db.execute(select(User).where(User.id == payload.carrier_user_id))).scalar_one_or_none()
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier user not found")
    if carrier.role not in (UserRole.owner, UserRole.driver):
        raise HTTPException(status_code=400, detail="User must be a fleet owner or driver")

    existing = (await db.execute(
        select(CompanyPreferredCarrier).where(
            CompanyPreferredCarrier.company_id == company_id,
            CompanyPreferredCarrier.carrier_user_id == payload.carrier_user_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Carrier already in preferred network")

    record = CompanyPreferredCarrier(
        company_id=company_id,
        carrier_user_id=payload.carrier_user_id,
        added_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    return {
        "id": str(record.id),
        "carrier_user_id": str(payload.carrier_user_id),
        "carrier_name": carrier.full_name,
        "partner_tier": carrier.partner_tier.value if carrier.partner_tier else "standard",
    }


@router.delete("/{company_id}/preferred-carriers/{carrier_user_id}", status_code=204)
async def remove_preferred_carrier(
    company_id: uuid.UUID,
    carrier_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.preferred_carrier import CompanyPreferredCarrier
    await _assert_company_admin(company_id, current_user, db)

    record = (await db.execute(
        select(CompanyPreferredCarrier).where(
            CompanyPreferredCarrier.company_id == company_id,
            CompanyPreferredCarrier.carrier_user_id == carrier_user_id,
        )
    )).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Carrier not in preferred network")

    await db.delete(record)
    await db.commit()
