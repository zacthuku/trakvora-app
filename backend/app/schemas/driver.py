import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.driver import AvailabilityStatus, VerificationStatus


class DriverProfileCreate(BaseModel):
    licence_number: str
    licence_class: str | None = None
    licence_expiry: str | None = None
    licence_photo_url: str | None = None
    bio: str | None = None
    experience_years: int | None = None


class DriverProfileUpdate(BaseModel):
    licence_number: str | None = None
    licence_class: str | None = None
    licence_expiry: str | None = None
    licence_photo_url: str | None = None
    passport_photo_url: str | None = None
    current_truck_id: uuid.UUID | None = None
    bio: str | None = None
    experience_years: int | None = None
    preferred_routes: str | None = None
    preferred_truck_types: str | None = None
    psv_badge_url: str | None = None
    police_clearance_url: str | None = None
    good_conduct_url: str | None = None
    medical_cert_url: str | None = None


class DriverAvailabilityUpdate(BaseModel):
    availability_status: AvailabilityStatus
    availability_location: str | None = None
    available_from: str | None = None
    seeking_employment: bool | None = None
    preferred_routes: str | None = None
    preferred_truck_types: str | None = None


class AssignDriverRequest(BaseModel):
    driver_user_id: uuid.UUID | None  # None to unassign


class DriverOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    employer_id: uuid.UUID | None
    licence_number: str
    licence_class: str | None
    licence_expiry: str | None
    licence_photo_url: str | None
    passport_photo_url: str | None
    verification_status: VerificationStatus
    ntsa_verified: bool
    psv_badge_url: str | None
    police_clearance_url: str | None
    good_conduct_url: str | None
    medical_cert_url: str | None
    bio: str | None
    experience_years: int | None
    preferred_routes: str | None
    preferred_truck_types: str | None
    availability_status: AvailabilityStatus
    availability_location: str | None
    available_from: str | None
    seeking_employment: bool
    current_truck_id: uuid.UUID | None
    created_at: datetime


class DriverPublicOut(BaseModel):
    """Sanitised driver profile visible to owners and shippers."""
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    employer_id: uuid.UUID | None
    licence_class: str | None
    licence_expiry: str | None
    verification_status: VerificationStatus
    ntsa_verified: bool
    bio: str | None
    experience_years: int | None
    preferred_routes: str | None
    preferred_truck_types: str | None
    availability_status: AvailabilityStatus
    availability_location: str | None
    available_from: str | None
    seeking_employment: bool
    current_truck_id: uuid.UUID | None
    created_at: datetime


class DriverVerificationUpdate(BaseModel):
    verification_status: VerificationStatus


class DriverWithUserOut(BaseModel):
    """Driver profile joined with their User row — for owner team / search views."""
    id: uuid.UUID
    user_id: uuid.UUID
    employer_id: uuid.UUID | None
    licence_class: str | None
    licence_expiry: str | None
    verification_status: VerificationStatus
    ntsa_verified: bool
    bio: str | None
    experience_years: int | None
    preferred_routes: str | None
    preferred_truck_types: str | None
    availability_status: AvailabilityStatus
    availability_location: str | None
    available_from: str | None
    seeking_employment: bool
    current_truck_id: uuid.UUID | None
    created_at: datetime
    # User fields
    full_name: str | None = None
    email: str | None = None
    profile_photo_url: str | None = None
    rating: float | None = None
    total_trips: int = 0


class JobPostCreate(BaseModel):
    title: str
    description: str
    location: str
    required_truck_type: str | None = None
    salary_range: str | None = None
