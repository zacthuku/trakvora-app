import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.company import Company, CompanyMember, CompanyMemberRole
from app.models.user import User, UserRole
from app.models.load import Load

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
        raise HTTPException(status_code=404, detail="No user found with that email")

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Basic spend and shipment analytics for a business account."""
    company = await _get_company_or_403(company_id, current_user, db)

    member_ids_result = await db.execute(
        select(CompanyMember.user_id).where(
            CompanyMember.company_id == company.id,
            CompanyMember.is_active == True,
        )
    )
    member_ids = [r[0] for r in member_ids_result.all()]

    loads_result = await db.execute(
        select(
            func.count(Load.id).label("total_loads"),
            func.sum(Load.price_kes).label("total_spend_kes"),
        ).where(Load.shipper_id.in_(member_ids))
    )
    row = loads_result.one()

    return {
        "company_id": str(company.id),
        "company_name": company.name,
        "member_count": len(member_ids),
        "total_loads": row.total_loads or 0,
        "total_spend_kes": float(row.total_spend_kes or 0),
    }
