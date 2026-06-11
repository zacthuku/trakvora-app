import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import AdminRole, KycStatus, UserRole


def _check_password(v: str) -> str:
    errors = []
    if len(v) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", v):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", v):
        errors.append("one lowercase letter")
    if not re.search(r"\d", v):
        errors.append("one digit")
    if not re.search(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\\|`~]', v):
        errors.append("one special character")
    if errors:
        raise ValueError(f"Password must contain: {', '.join(errors)}")
    return v


CURRENT_TERMS_VERSION = "v1.0"


class UserRegister(BaseModel):
    email: EmailStr
    phone: str = Field(..., min_length=8, max_length=25)
    full_name: str = Field(..., min_length=2, max_length=255)
    company_name: str | None = None
    password: str = Field(..., min_length=8)
    role: UserRole
    country: str = Field(default="KE", min_length=2, max_length=2)
    national_id: str | None = Field(None, max_length=50)
    kra_pin: str | None = Field(None, max_length=20)
    # Optional — links registration to an existing invite token
    invite_token: str | None = None
    # Must be True — stored with timestamp + version on the user record
    terms_accepted: bool = False

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _check_password(v)

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str) -> str:
        v = v.upper()
        if len(v) != 2 or not v.isalpha():
            raise ValueError("Country must be a valid 2-letter ISO code (e.g. KE, UG, US)")
        return v

    @field_validator("kra_pin")
    @classmethod
    def validate_kra_pin(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().upper()
        # Kenya KRA PIN: letter + 9 digits + letter (e.g. P000111111A)
        # Only enforce the Kenya format; other countries pass through
        if re.match(r"^[A-Z]", v) and len(v) == 11:
            if not re.match(r"^[A-Z]\d{9}[A-Z]$", v):
                raise ValueError("Invalid KRA PIN format. Expected format: P000111111A (letter + 9 digits + letter)")
        return v

    @field_validator("terms_accepted")
    @classmethod
    def must_accept_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the Trakvora Terms of Service to register")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PhoneLoginRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=25)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = False


class OTPRequiredResponse(BaseModel):
    """Returned after registration or when a verified user's channel is already set."""
    requires_verification: bool = True
    email: str
    channel: str = "email"
    destination: str = ""


class OTPChannelRequiredResponse(BaseModel):
    """Returned on first post-registration login — user must pick their 2FA channel."""
    requires_channel_selection: bool = True
    email: str
    phone_available: bool


class SendOTPRequest(BaseModel):
    email: EmailStr
    channel: str = Field(..., pattern="^(email|sms)$")


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class ResendOTPRequest(BaseModel):
    email: EmailStr


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _check_password(v)


class PasswordResetTokenResponse(BaseModel):
    reset_token: str


class ForgotPasswordPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=25)


class VerifyResetOtpPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=25)
    code: str = Field(..., min_length=6, max_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _check_password(v)


class UserUpdate(BaseModel):
    full_name: str | None = None
    company_name: str | None = None
    phone: str | None = None
    profile_photo_url: str | None = None
    otp_channel: str | None = None
    country: str | None = None
    kra_pin: str | None = Field(None, max_length=20)

    @field_validator("kra_pin")
    @classmethod
    def validate_kra_pin_update(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().upper()
        if re.match(r"^[A-Z]", v) and len(v) == 11:
            if not re.match(r"^[A-Z]\d{9}[A-Z]$", v):
                raise ValueError("Invalid KRA PIN format. Expected format: P000111111A (letter + 9 digits + letter)")
        return v

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if len(v) != 2 or not v.isalpha():
            raise ValueError("Country must be a valid 2-letter ISO code (e.g. KE, UG, US)")
        return v


class RoleChangeRequest(BaseModel):
    role: UserRole


class GoogleAuthRequest(BaseModel):
    access_token: str
    role: UserRole | None = None
    terms_accepted: bool = False


class GoogleNewUserResponse(BaseModel):
    requires_role_selection: bool = True
    email: str
    full_name: str
    profile_photo_url: str | None = None


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: str
    phone: str | None
    full_name: str
    company_name: str | None
    role: UserRole
    admin_role: AdminRole | None = None
    is_active: bool
    is_verified: bool
    otp_channel: str | None
    country: str | None
    rating: float | None
    total_trips: int
    profile_photo_url: str | None
    created_at: datetime
    kyc_status: KycStatus = KycStatus.unverified
    kyc_rejection_reason: str | None = None
    kyc_selfie_url: str | None = None
    kra_pin: str | None = None
    can_carry: bool = False
    can_ship: bool = False
    can_use_escrow: bool = False


class UserPublicOut(BaseModel):
    """Safe public profile — no email/phone, suitable for any authenticated viewer."""
    model_config = {"from_attributes": True}

    id:                uuid.UUID
    full_name:         str
    company_name:      str | None
    profile_photo_url: str | None
    rating:            float | None
    total_trips:       int
    role:              UserRole
