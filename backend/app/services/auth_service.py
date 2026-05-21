import secrets
import uuid

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.currency import currency_for_user
from app.core.exceptions import ConflictError, UnauthorizedError, ValidationError
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.user import UserRole
from app.models.provider_profile import AirFreightProfile, MoverProfile, ParcelCarrierProfile
from app.repositories.otp_repo import OTPRepository
from app.repositories.user_repo import UserRepository
from app.repositories.wallet_repo import WalletRepository
from app.schemas.user import (
    GoogleNewUserResponse, OTPRequiredResponse,
    TokenResponse, UserRegister,
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


async def _dispatch_otp(user, channel: str, otp_repo: OTPRepository) -> tuple[str, str]:
    """Create OTP, send it, return (channel_used, masked_destination)."""
    code = await otp_repo.create(user.email)

    if channel == "sms" and user.phone:
        await sms_service.send_otp_sms(user.phone, code, user.full_name)
        return "sms", _mask_phone(user.phone)
    else:
        await email_service.send_otp_email(user.email, code, user.full_name)
        return "email", _mask_email(user.email)


async def register_user(payload: UserRegister, db: AsyncSession) -> TokenResponse:
    user_repo = UserRepository(db)
    if await user_repo.get_by_email(payload.email):
        raise ConflictError("Email already registered")
    if await user_repo.get_by_phone(payload.phone):
        raise ConflictError("Phone number already registered")

    user = await user_repo.create(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        company_name=payload.company_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        country=payload.country,
    )

    wallet_repo = WalletRepository(db)
    await wallet_repo.create_wallet(user.id, currency=currency_for_user(user))

    await user_repo.update(user, is_verified=True)
    await email_service.send_welcome_email(user.email, user.full_name, user.role.value)

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

    return TokenResponse(
        access_token=create_access_token(
            str(user.id), user.role,
            admin_role=user.admin_role.value if user.admin_role else None,
        ),
        refresh_token=create_refresh_token(str(user.id)),
    )


async def login_user(email: str, password: str, db: AsyncSession) -> TokenResponse:
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(email)
    if not user or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid credentials")
    if not user.is_active:
        raise UnauthorizedError("Account is disabled")

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


async def google_auth(
    access_token: str,
    role: UserRole | None,
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
        wallet_repo = WalletRepository(db)
        await wallet_repo.create_wallet(user.id, currency=currency_for_user(user))
        await db.commit()
        await email_service.send_welcome_email(user.email, user.full_name, user.role.value)

    if not user.is_active:
        raise UnauthorizedError("Account is disabled")

    return TokenResponse(
        access_token=create_access_token(
            str(user.id), user.role,
            admin_role=user.admin_role.value if user.admin_role else None,
        ),
        refresh_token=create_refresh_token(str(user.id)),
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
