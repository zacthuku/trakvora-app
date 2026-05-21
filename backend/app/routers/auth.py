from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.user import (
    GoogleAuthRequest, OTPRequiredResponse, RefreshRequest, ResendOTPRequest,
    SendOTPRequest, TokenResponse, UserLogin, UserRegister, VerifyOTPRequest,
)

from app.services import auth_service

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    return await auth_service.register_user(payload, db)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    return await auth_service.login_user(payload.email, payload.password, db)


@router.post("/send-otp", response_model=OTPRequiredResponse)
async def send_otp(payload: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.send_otp_and_set_channel(payload.email, payload.channel, db)


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.verify_otp(payload.email, payload.code, db)


@router.post("/resend-otp", status_code=204)
async def resend_otp(payload: ResendOTPRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.resend_otp(payload.email, db)


@router.post("/google")
async def google_auth(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.google_auth(payload.access_token, payload.role, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_tokens(payload.refresh_token, db)
