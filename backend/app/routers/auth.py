from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import (
    GoogleAuthRequest, OTPRequiredResponse, PhoneLoginRequest, RefreshRequest, ResendOTPRequest,
    SendOTPRequest, TokenResponse, UserLogin, UserRegister, VerifyOTPRequest,
    ForgotPasswordRequest, VerifyResetOtpRequest, ResetPasswordRequest,
    PasswordResetTokenResponse, ChangePasswordRequest,
    ForgotPasswordPhoneRequest, VerifyResetOtpPhoneRequest,
)

from app.services import auth_service

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=OTPRequiredResponse, status_code=201)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    return await auth_service.register_user(payload, db)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    return await auth_service.login_user(payload.email, payload.password, db)


@router.post("/send-otp", response_model=OTPRequiredResponse)
async def send_otp(payload: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.send_otp_and_set_channel(payload.email, payload.channel, db)


@router.post("/phone-login", response_model=OTPRequiredResponse)
async def phone_login(payload: PhoneLoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.send_phone_otp(payload.phone, db)


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.verify_otp(payload.email, payload.code, db)


@router.post("/resend-otp", status_code=204)
async def resend_otp(payload: ResendOTPRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.resend_otp(payload.email, db)


@router.post("/google")
async def google_auth(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.google_auth(payload.access_token, payload.role, payload.terms_accepted, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_tokens(payload.refresh_token, db)


@router.post("/forgot-password", status_code=204)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.request_password_reset(payload.email, db)


@router.post("/verify-reset-otp", response_model=PasswordResetTokenResponse)
async def verify_reset_otp(payload: VerifyResetOtpRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.verify_reset_otp(payload.email, payload.code, db)


@router.post("/forgot-password-phone", status_code=204)
async def forgot_password_phone(payload: ForgotPasswordPhoneRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.request_password_reset_phone(payload.phone, db)


@router.post("/verify-reset-otp-phone", response_model=PasswordResetTokenResponse)
async def verify_reset_otp_phone(payload: VerifyResetOtpPhoneRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.verify_reset_otp_phone(payload.phone, payload.code, db)


@router.post("/reset-password", status_code=204)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.reset_password(payload.reset_token, payload.new_password, db)


@router.post("/change-password", status_code=204)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.change_password(
        current_user, payload.current_password, payload.new_password, db
    )
