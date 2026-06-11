import secrets
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.core.currency import currency_for_user
from app.core.exceptions import ConflictError, UnauthorizedError, ValidationError
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
    create_password_reset_token, decode_password_reset_token,
)
from app.models.company import CompanyMember, CompanyMemberRole
from app.models.driver import Driver
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import AdminRole, UserRole
from app.models.provider_profile import AirFreightProfile, MoverProfile, ParcelCarrierProfile
from app.repositories.otp_repo import OTPRepository
from app.repositories.user_repo import UserRepository
from app.repositories.wallet_repo import WalletRepository
from app.schemas.user import (
    CURRENT_TERMS_VERSION, GoogleNewUserResponse, OTPRequiredResponse,
    TokenResponse, UserRegister,
    PasswordResetTokenResponse,
)
from app.services import email_service, notification_service, sms_service
from app.services.activity_service import log_activity


def _mask_email(email: str) -> str:
    user, domain = email.split("@")
    visible = user[:2]
    return f"{visible}{'*' * max(1, len(user) - 2)}@{domain}"


def _mask_phone(phone: str) -> str:
    if len(phone) <= 4:
        return phone
    return phone[:3] + "*" * (len(phone) - 6) + phone[-3:]


async def _assign_free_plan(user, db: AsyncSession) -> None:
    """Auto-subscribe a new user to the free plan for their role."""
    from app.models.subscription import Subscription, SubscriptionPlan, SubscriptionStatus
    role_map = {
        UserRole.shipper: "shipper",
        UserRole.owner: "owner",
        UserRole.owner_user: "owner",
        UserRole.driver: "driver",
    }
    target_role = role_map.get(user.role)
    if not target_role:
        return
    plan = (await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.target_role == target_role,
            SubscriptionPlan.price_kes == 0,
            SubscriptionPlan.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    if plan:
        now = datetime.now(timezone.utc)
        db.add(Subscription(
            user_id=user.id,
            plan_id=plan.id,
            status=SubscriptionStatus.active,
            current_period_start=now,
            current_period_end=None,
        ))


async def _dispatch_otp(user, channel: str, otp_repo: OTPRepository) -> tuple[str, str]:
    """Create OTP, send it, return (channel_used, masked_destination)."""
    code = await otp_repo.create(user.email)

    if channel == "sms" and user.phone:
        await sms_service.send_otp_sms(user.phone, code, user.full_name)
        return "sms", _mask_phone(user.phone)
    else:
        await email_service.send_otp_email(user.email, code, user.full_name)
        return "email", _mask_email(user.email)


async def register_user(payload: UserRegister, db: AsyncSession) -> OTPRequiredResponse:
    user_repo = UserRepository(db)

    # Email uniqueness — differentiate deleted vs. active conflict
    existing_email = await user_repo.get_by_email(payload.email)
    if existing_email:
        if existing_email.deleted_at is not None:
            raise ConflictError({"code": "CONTACT_SUPPORT", "message": "This email is linked to a deactivated account. Contact support to reactivate it."})  # type: ignore[arg-type]
        raise ConflictError("Email already registered")

    # Phone uniqueness — same distinction
    existing_phone = await user_repo.get_by_phone(payload.phone)
    if existing_phone:
        if existing_phone.deleted_at is not None:
            raise ConflictError({"code": "CONTACT_SUPPORT", "message": "This phone number is linked to a deactivated account. Contact support to reactivate it."})  # type: ignore[arg-type]
        raise ConflictError("Phone number already registered")

    # National ID / KRA PIN — must be unique across ALL accounts (including deleted)
    if payload.national_id:
        if await user_repo.get_by_national_id(payload.national_id):
            raise ConflictError("An account is already registered with this National ID.")
    if payload.kra_pin:
        if await user_repo.get_by_kra_pin(payload.kra_pin):
            raise ConflictError("An account is already registered with this KRA PIN.")

    # Permanent ban check — match against identity snapshot of all banned accounts
    banned = await user_repo.get_banned_with_matching_identifiers(
        email=payload.email,
        phone=payload.phone,
        national_id=payload.national_id,
        kra_pin=payload.kra_pin,
    )
    if banned:
        raise ConflictError({"code": "ACCOUNT_BANNED", "message": "Registration is not available for this account. Please contact support."})  # type: ignore[arg-type]

    user = await user_repo.create(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        company_name=payload.company_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        country=payload.country,
        national_id=payload.national_id,
        kra_pin=payload.kra_pin,
        terms_accepted_at=datetime.now(timezone.utc) if payload.terms_accepted else None,
        terms_version=CURRENT_TERMS_VERSION if payload.terms_accepted else None,
    )

    wallet_repo = WalletRepository(db)
    await wallet_repo.create_wallet(user.id, currency=currency_for_user(user))
    await _assign_free_plan(user, db)

    # Do NOT auto-verify — send OTP to phone (or email fallback) for account verification

    # Auto-create service provider profile
    if user.role == UserRole.mover:
        db.add(MoverProfile(user_id=user.id))
    elif user.role == UserRole.air_freight:
        db.add(AirFreightProfile(user_id=user.id))
    elif user.role == UserRole.parcel_carrier:
        db.add(ParcelCarrierProfile(user_id=user.id))

    action = "provider_registered" if user.role.value in ("mover", "air_freight", "parcel_carrier") else "user_registered"
    await log_activity(
        db,
        action=action,
        summary=f"New {user.role.value.replace('_', ' ')} registered: {user.full_name} ({user.email})",
        resource_type="user",
        resource_id=user.id,
        meta={"role": user.role.value, "country": getattr(user, "country", None)},
    )
    if user.role.value == "driver":
        await notification_service.notify_all_admins(
            db,
            title="New Driver Registered",
            body=f"{user.full_name} registered as a driver and may need verification.",
            roles=["super_admin", "operations_admin"],
        )
    elif user.role.value in ("mover", "air_freight", "parcel_carrier"):
        await notification_service.notify_all_admins(
            db,
            title="New Service Provider Registered",
            body=f"{user.full_name} registered as {user.role.value.replace('_', ' ')} — may need verification.",
            roles=["super_admin", "operations_admin"],
        )

    # ── Process invite token if provided ──────────────────────────────────────
    if payload.invite_token:
        from datetime import datetime, timezone
        inv_result = await db.execute(
            select(Invitation).where(
                Invitation.token == payload.invite_token,
                Invitation.status == InvitationStatus.pending,
            )
        )
        invite = inv_result.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if invite and invite.expires_at > now:
            # Validate email and role match (invite.role is a plain string)
            if (invite.invitee_email.lower() == payload.email.lower()
                    and invite.role == payload.role.value):
                # 1. Company team member
                if invite.company_id:
                    cm_role = CompanyMemberRole(invite.company_member_role or "viewer")
                    db.add(CompanyMember(
                        company_id=invite.company_id,
                        user_id=user.id,
                        role=cm_role,
                        invited_by=invite.inviter_id,
                    ))

                # 2. Driver employment
                if invite.employer_user_id and payload.role == UserRole.driver:
                    drv_result = await db.execute(
                        select(Driver).where(Driver.user_id == user.id)
                    )
                    driver = drv_result.scalar_one_or_none()
                    if driver:
                        driver.employer_id = invite.employer_user_id

                # 3. Admin role upgrade
                if invite.admin_role and payload.role == UserRole.admin:
                    from app.models.user import AdminRole
                    await user_repo.update(user, role=UserRole.admin,
                                           admin_role=AdminRole(invite.admin_role))

                invite.status = InvitationStatus.accepted
                await db.commit()
            else:
                # Invite exists but email/role mismatch — reject registration
                from fastapi import HTTPException as _HTTPException
                raise _HTTPException(
                    status_code=400,
                    detail="Invite details do not match your registration information.",
                )
        elif invite:
            # Invite found but already expired — mark it and reject
            invite.status = InvitationStatus.expired
            await db.commit()
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(status_code=400, detail="This invite link has expired.")

    otp_repo = OTPRepository(db)
    channel_used, destination = await _dispatch_otp(user, "sms" if user.phone else "email", otp_repo)
    return OTPRequiredResponse(email=user.email, channel=channel_used, destination=destination)


async def login_user(email: str, password: str, db: AsyncSession) -> TokenResponse:
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid credentials")
    if user.deleted_at is not None:
        raise UnauthorizedError({"code": "ACCOUNT_DEACTIVATED", "message": "This account has been deactivated. Contact support to reactivate it."})  # type: ignore[arg-type]
    if user.is_banned:
        raise UnauthorizedError({"code": "ACCOUNT_BANNED", "message": "Your account has been permanently suspended. Please contact support."})  # type: ignore[arg-type]
    if not user.is_active:
        raise UnauthorizedError({"code": "ACCOUNT_SUSPENDED", "message": "Your account is suspended. Please contact support to resolve this."})  # type: ignore[arg-type]

    if not user.is_verified:
        await user_repo.update(user, is_verified=True)

    return TokenResponse(
        access_token=create_access_token(
            str(user.id), user.role,
            admin_role=user.admin_role.value if user.admin_role else None,
        ),
        refresh_token=create_refresh_token(str(user.id)),
    )


async def send_otp_and_set_channel(email: str, channel: str, db: AsyncSession) -> OTPRequiredResponse:
    """Called after channel selection on first login. Saves preference and sends OTP."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user or not user.is_active:
        # Don't reveal existence — just proceed silently
        return OTPRequiredResponse(email=email, channel=channel, destination="")

    if channel == "sms" and not user.phone:
        raise ValidationError("No phone number registered on this account.")

    # Persist channel preference
    await user_repo.update(user, otp_channel=channel)

    otp_repo = OTPRepository(db)
    channel_used, destination = await _dispatch_otp(user, channel, otp_repo)
    return OTPRequiredResponse(
        email=user.email,
        channel=channel_used,
        destination=destination,
    )


async def verify_otp(email: str, code: str, db: AsyncSession) -> TokenResponse:
    otp_repo = OTPRepository(db)
    valid = await otp_repo.verify(email, code)
    if not valid:
        raise ValidationError("Invalid or expired code. Please try again.")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user:
        raise UnauthorizedError("User not found")

    first_verify = not user.is_verified
    await user_repo.update(user, is_verified=True)

    if first_verify:
        await email_service.send_welcome_email(user.email, user.full_name, user.role.value)

    return TokenResponse(
        access_token=create_access_token(
            str(user.id), user.role,
            admin_role=user.admin_role.value if user.admin_role else None,
        ),
        refresh_token=create_refresh_token(str(user.id)),
    )


async def resend_otp(email: str, db: AsyncSession) -> None:
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user:
        return

    channel = user.otp_channel or "email"
    otp_repo = OTPRepository(db)
    await _dispatch_otp(user, channel, otp_repo)


async def send_phone_otp(phone: str, db: AsyncSession) -> OTPRequiredResponse:
    """Passwordless login: look up user by phone, send SMS OTP, return masked destination."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_phone(phone)
    if not user or not user.is_active:
        # Don't reveal whether the phone number is registered
        return OTPRequiredResponse(email="", channel="sms", destination=_mask_phone(phone) if len(phone) >= 4 else "****")

    otp_repo = OTPRepository(db)
    channel_used, destination = await _dispatch_otp(user, "sms", otp_repo)
    return OTPRequiredResponse(email=user.email, channel=channel_used, destination=destination)


async def google_auth(
    access_token: str,
    role: UserRole | None,
    terms_accepted: bool,
    db: AsyncSession,
) -> TokenResponse | GoogleNewUserResponse:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v1/userinfo",
                params={"access_token": access_token},
            )
    except (httpx.ConnectTimeout, httpx.ConnectError, httpx.TimeoutException):
        raise HTTPException(status_code=503, detail="Could not reach Google. Please try again.")
    if resp.status_code != 200:
        raise UnauthorizedError("Invalid Google token")

    info = resp.json()
    if not info.get("verified_email", False):
        raise UnauthorizedError("Google email is not verified")

    email: str = info["email"]
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)

    if not user:
        if not role:
            return GoogleNewUserResponse(
                email=email,
                full_name=info.get("name", email.split("@")[0]),
                profile_photo_url=info.get("picture"),
            )
        if not terms_accepted:
            raise HTTPException(status_code=400, detail="You must accept the Terms of Service to create an account.")
        user = await user_repo.create(
            email=email,
            phone=None,
            full_name=info.get("name", email.split("@")[0]),
            company_name=None,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            role=role,
            is_active=True,
            is_verified=True,
            profile_photo_url=info.get("picture"),
        )
        user.terms_accepted_at = datetime.now(timezone.utc)
        user.terms_version = "v1.0"
        wallet_repo = WalletRepository(db)
        await wallet_repo.create_wallet(user.id, currency=currency_for_user(user))
        await _assign_free_plan(user, db)
        await db.commit()
        await email_service.send_welcome_email(user.email, user.full_name, user.role.value)
        return TokenResponse(
            access_token=create_access_token(
                str(user.id), user.role,
                admin_role=user.admin_role.value if user.admin_role else None,
            ),
            refresh_token=create_refresh_token(str(user.id)),
            is_new_user=True,
        )

    if not user.is_active:
        raise UnauthorizedError("Account is disabled")

    return TokenResponse(
        access_token=create_access_token(
            str(user.id), user.role,
            admin_role=user.admin_role.value if user.admin_role else None,
        ),
        refresh_token=create_refresh_token(str(user.id)),
        is_new_user=False,
    )


async def refresh_tokens(refresh_token: str, db: AsyncSession) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        user_id = payload["sub"]
    except (ValueError, KeyError):
        raise UnauthorizedError("Invalid refresh token")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(uuid.UUID(user_id))
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(
            str(user.id), user.role,
            admin_role=user.admin_role.value if user.admin_role else None,
        ),
        refresh_token=create_refresh_token(str(user.id)),
    )


async def request_password_reset(email: str, db: AsyncSession) -> None:
    """Send a password-reset OTP. Silent no-op if email is unknown — prevents enumeration."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user or not user.is_active:
        return
    code = await OTPRepository(db).create(user.email)
    await email_service.send_password_reset_otp_email(user.email, code, user.full_name)


async def request_password_reset_phone(phone: str, db: AsyncSession) -> None:
    """Send a password-reset OTP via SMS. Silent no-op if phone unknown — prevents enumeration."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_phone(phone)
    if not user or not user.is_active:
        return
    code = await OTPRepository(db).create_phone(phone)
    await sms_service.send_otp_sms(phone, code)


async def verify_reset_otp_phone(phone: str, code: str, db: AsyncSession) -> PasswordResetTokenResponse:
    """Validate the phone OTP and return a short-lived password_reset JWT."""
    valid = await OTPRepository(db).verify_phone(phone, code)
    if not valid:
        raise ValidationError("Invalid or expired code. Please try again.")
    user_repo = UserRepository(db)
    user = await user_repo.get_by_phone(phone)
    if not user or not user.is_active:
        raise UnauthorizedError("Account not found or disabled")
    return PasswordResetTokenResponse(reset_token=create_password_reset_token(user.email))


async def verify_reset_otp(email: str, code: str, db: AsyncSession) -> PasswordResetTokenResponse:
    """Validate the OTP and return a short-lived password_reset JWT."""
    valid = await OTPRepository(db).verify(email, code)
    if not valid:
        raise ValidationError("Invalid or expired code. Please try again.")
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user or not user.is_active:
        raise UnauthorizedError("Account not found or disabled")
    return PasswordResetTokenResponse(reset_token=create_password_reset_token(user.email))


async def reset_password(reset_token: str, new_password: str, db: AsyncSession) -> None:
    """Validate the password_reset JWT and update the user's hashed password."""
    try:
        email = decode_password_reset_token(reset_token)
    except ValueError:
        raise UnauthorizedError("Invalid or expired reset token")
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user or not user.is_active:
        raise UnauthorizedError("Account not found or disabled")
    await user_repo.update(user, hashed_password=hash_password(new_password))


async def change_password(
    user: "User", current_password: str, new_password: str, db: AsyncSession
) -> None:
    """Verify current password and update to new password for an authenticated user."""
    if not verify_password(current_password, user.hashed_password):
        raise UnauthorizedError("Current password is incorrect.")
    await UserRepository(db).update(user, hashed_password=hash_password(new_password))


async def change_role(user: "User", new_role: UserRole, db: AsyncSession) -> "User":
    """Switch a user's role, subject to account-type and active-job guards."""
    from app.core.exceptions import ConflictError, ForbiddenError
    from app.repositories.shipment_repo import ShipmentRepository
    from app.models.load import Load, LoadStatus

    if new_role == user.role:
        raise ValidationError("You already have this role.")

    allowed = {UserRole.shipper, UserRole.owner, UserRole.driver}
    if new_role not in allowed:
        raise ForbiddenError("Role change to this role is not permitted.")

    if new_role == UserRole.driver and user.company_name:
        raise ForbiddenError("Driver accounts must be individual. Company accounts cannot switch to the driver role.")

    shipment_repo = ShipmentRepository(db)

    if user.role == UserRole.driver:
        if await shipment_repo.get_active_by_driver(user.id):
            raise ConflictError("You have an active shipment in progress. Complete or cancel it before changing your role.")

    elif user.role in (UserRole.owner, UserRole.owner_user):
        if await shipment_repo.get_active_by_owner(user.id):
            raise ConflictError("You have active fleet shipments in progress. Complete or cancel them before changing your role.")

    elif user.role == UserRole.shipper:
        active_statuses = [
            LoadStatus.bidding, LoadStatus.booked,
            LoadStatus.en_route_pickup, LoadStatus.loaded, LoadStatus.in_transit,
        ]
        result = await db.execute(
            select(Load).where(Load.shipper_id == user.id, Load.status.in_(active_statuses)).limit(1)
        )
        if result.scalar_one_or_none():
            raise ConflictError("You have active loads in progress. Complete or cancel them before changing your role.")

    await UserRepository(db).update(user, role=new_role)
    return user
