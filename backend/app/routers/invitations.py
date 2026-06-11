"""
Invite-link onboarding system.

Three contexts covered by one endpoint:
  1. Company team member  — POST /invitations with company_id
  2. Driver employment    — POST /invitations with role=driver (employer_user_id auto-set)
  3. Admin staff          — POST /invitations with role=admin + admin_role (super_admin only)

Public validation route (/invitations/validate/{token}) is consumed by the frontend
registration page before the user fills in their details.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.company import Company, CompanyMember, CompanyMemberRole
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User, UserRole
from app.services import email_service

router = APIRouter(prefix="/invitations", tags=["invitations"])

FRONTEND_BASE = getattr(settings, "frontend_url", "http://localhost:5173")


# ── Schemas ───────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    role: UserRole
    company_id: uuid.UUID | None = None
    employer_user_id: uuid.UUID | None = None
    admin_role: str | None = None  # AdminRole value as string
    # company_member_role (admin/ops/viewer) for team invites
    company_member_role: CompanyMemberRole = CompanyMemberRole.viewer


class InviteOut(BaseModel):
    id: uuid.UUID
    token: str
    invitee_email: str
    role: str
    status: InvitationStatus
    expires_at: datetime
    company_id: uuid.UUID | None
    employer_user_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class InviteValidation(BaseModel):
    """Returned to the public /validate route — used by the registration page."""
    invitee_email: str
    role: str
    admin_role: str | None
    company_id: uuid.UUID | None
    company_name: str | None
    inviter_name: str
    expires_at: datetime
    status: InvitationStatus
    company_member_role: str | None  # "admin" | "ops" | "viewer" | None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _assert_company_admin(company_id: uuid.UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_user_id != user.id and user.role != UserRole.admin:
        # Check CompanyMember admin role
        m_result = await db.execute(
            select(CompanyMember).where(
                CompanyMember.company_id == company_id,
                CompanyMember.user_id == user.id,
                CompanyMember.role == CompanyMemberRole.admin,
                CompanyMember.is_active == True,  # noqa: E712
            )
        )
        if not m_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Only company admins can send invites")
    return company


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=InviteOut, status_code=201)
async def create_invite(
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create an invite link and send it by email.

    - Company team invite: supply company_id + role (shipper or owner)
    - Driver invite: supply role=driver (employer_user_id defaults to current user's id)
    - Admin invite: supply role=admin + admin_role (super_admin only)
    """
    company: Company | None = None

    # ── Authorization ──────────────────────────────────────────────────────────
    if body.role == UserRole.admin:
        if not current_user.admin_role or current_user.admin_role.value != "super_admin":
            raise HTTPException(status_code=403, detail="Only super admins can invite admin staff")
        if not body.admin_role:
            raise HTTPException(status_code=422, detail="admin_role is required when inviting admin staff")

    elif body.company_id:
        company = await _assert_company_admin(body.company_id, current_user, db)

    elif body.role == UserRole.driver:
        if current_user.role not in (UserRole.owner, UserRole.admin):
            raise HTTPException(status_code=403, detail="Only fleet owners can invite drivers")
        # Employer defaults to the inviting owner
        if body.employer_user_id is None:
            body.employer_user_id = current_user.id  # type: ignore[assignment]

    # ── Shortcut: invitee already on platform AND this is a company invite ─────
    if body.company_id:
        existing_result = await db.execute(
            select(User).where(User.email == body.email)
        )
        existing_user = existing_result.scalar_one_or_none()
        if existing_user:
            # Add directly — no token needed
            m_res = await db.execute(
                select(CompanyMember).where(
                    CompanyMember.company_id == body.company_id,
                    CompanyMember.user_id == existing_user.id,
                )
            )
            m = m_res.scalar_one_or_none()
            if m and m.is_active:
                raise HTTPException(status_code=409, detail="User is already a member of this company")
            if m:
                m.is_active = True
                m.role = body.company_member_role
            else:
                db.add(CompanyMember(
                    company_id=body.company_id,
                    user_id=existing_user.id,
                    role=body.company_member_role,
                    invited_by=current_user.id,
                ))
            await db.commit()
            # Return a synthetic "accepted" invite object so the frontend can handle it uniformly
            return InviteOut(
                id=uuid.uuid4(),
                token="",
                invitee_email=str(body.email),
                role=body.role.value,
                status=InvitationStatus.accepted,
                expires_at=datetime.now(timezone.utc),
                company_id=body.company_id,
                employer_user_id=None,
            )

    # ── Cancel any previous pending invite for same email + context ───────────
    existing_inv_result = await db.execute(
        select(Invitation).where(
            Invitation.invitee_email == body.email,
            Invitation.status == InvitationStatus.pending,
            Invitation.company_id == body.company_id,
        )
    )
    for old in existing_inv_result.scalars().all():
        old.status = InvitationStatus.cancelled

    # ── Create fresh invitation ────────────────────────────────────────────────
    invite = Invitation(
        inviter_id=current_user.id,
        invitee_email=str(body.email),
        role=body.role.value,
        company_id=body.company_id,
        employer_user_id=body.employer_user_id,
        admin_role=body.admin_role,
        company_member_role=body.company_member_role.value if body.company_member_role else "viewer",
    )

    db.add(invite)
    await db.flush()  # get invite.token

    invite_url = f"{FRONTEND_BASE}/register/invite/{invite.token}"
    company_name = company.name if company else None
    await email_service.send_invitation_email(
        to_email=str(body.email),
        inviter_name=current_user.full_name,
        role=body.role.value,
        company_name=company_name,
        invite_url=invite_url,
    )

    await db.commit()
    await db.refresh(invite)
    return invite


@router.get("/validate/{token}", response_model=InviteValidation)
async def validate_invite(token: str, db: AsyncSession = Depends(get_db)):
    """
    Public — no authentication required.
    Used by the frontend /register/invite/:token page to display context and pre-fill the form.
    """
    result = await db.execute(
        select(Invitation).where(Invitation.token == token)
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite link not found")

    # Auto-expire if past deadline
    if invite.status == InvitationStatus.pending and invite.expires_at < datetime.now(timezone.utc):
        invite.status = InvitationStatus.expired
        await db.commit()

    if invite.status != InvitationStatus.pending:
        raise HTTPException(
            status_code=410,
            detail=f"This invite link has already been {invite.status.value}."
        )

    # Load inviter and company names
    inviter_res = await db.execute(select(User).where(User.id == invite.inviter_id))
    inviter = inviter_res.scalar_one_or_none()

    company_name: str | None = None
    if invite.company_id:
        company_res = await db.execute(select(Company).where(Company.id == invite.company_id))
        c = company_res.scalar_one_or_none()
        if c:
            company_name = c.name

    return InviteValidation(
        invitee_email=invite.invitee_email,
        role=invite.role,
        admin_role=invite.admin_role,
        company_id=invite.company_id,
        company_name=company_name,
        inviter_name=inviter.full_name if inviter else "Someone",
        expires_at=invite.expires_at,
        status=invite.status,
        company_member_role=getattr(invite, "company_member_role", "viewer"),
    )


@router.patch("/{invite_id}/cancel", status_code=204)
async def cancel_invite(
    invite_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a pending invite. Only the inviter or a company admin can cancel."""
    result = await db.execute(select(Invitation).where(Invitation.id == invite_id))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Authorization
    if invite.inviter_id != current_user.id:
        if invite.company_id:
            await _assert_company_admin(invite.company_id, current_user, db)
        elif current_user.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Not authorised to cancel this invite")

    if invite.status != InvitationStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending invites can be cancelled")

    invite.status = InvitationStatus.cancelled
    await db.commit()


@router.get("/pending", response_model=list[InviteOut])
async def list_pending_invites(
    company_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List pending invites sent by the current user (or for a company they admin).
    Used by TeamManagementPage to show the 'Pending Invites' section.
    """
    query = select(Invitation).where(Invitation.status == InvitationStatus.pending)

    if company_id:
        await _assert_company_admin(company_id, current_user, db)
        query = query.where(Invitation.company_id == company_id)
    else:
        query = query.where(Invitation.inviter_id == current_user.id)

    result = await db.execute(query.order_by(Invitation.created_at.desc()))
    return result.scalars().all()
