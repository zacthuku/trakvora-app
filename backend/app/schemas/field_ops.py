import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.inspection_task import TaskStatus
from app.models.vehicle_inspection import VehicleCondition, TrackerStatus
from app.models.compliance_review import ReviewDecision


# ── InspectionTask ──────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    truck_id: uuid.UUID
    owner_id: uuid.UUID
    location: str | None = None
    location_lat: float | None = None
    location_lon: float | None = None
    deadline: datetime | None = None
    notes: str | None = None


class TaskAssign(BaseModel):
    inspector_user_id: uuid.UUID


class TaskOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    truck_id: uuid.UUID
    owner_id: uuid.UUID
    assigned_to: uuid.UUID | None
    status: TaskStatus
    location: str | None
    location_lat: float | None
    location_lon: float | None
    deadline: datetime | None
    assigned_at: datetime | None
    notes: str | None
    created_at: datetime


# ── VehicleInspection ───────────────────────────────────────────────────────

class InspectionSubmit(BaseModel):
    photo_urls: dict = Field(..., description="Keys: front, back, left, right, interior, plate")
    driver_photo_url: str | None = None
    condition: VehicleCondition
    score: int = Field(..., ge=1, le=5)
    damages: str | None = None
    roadworthy: bool
    tracker_status: TrackerStatus = TrackerStatus.not_installed
    tracker_id: str | None = None
    notes: str | None = None
    checklist: dict | None = None
    inspection_lat: float | None = None
    inspection_lon: float | None = None


class InspectionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    task_id: uuid.UUID
    inspector_id: uuid.UUID
    truck_id: uuid.UUID
    photo_urls: dict | None
    driver_photo_url: str | None
    condition: VehicleCondition | None
    score: int | None
    damages: str | None
    roadworthy: bool | None
    tracker_status: TrackerStatus
    tracker_id: str | None
    notes: str | None
    checklist: dict | None
    submitted_at: datetime | None
    inspection_lat: float | None
    inspection_lon: float | None
    created_at: datetime


# ── ComplianceReview ────────────────────────────────────────────────────────

class ReviewSubmit(BaseModel):
    decision: ReviewDecision
    notes: str | None = None


class ReviewOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    inspection_id: uuid.UUID
    reviewer_id: uuid.UUID
    decision: ReviewDecision
    notes: str | None
    reviewed_at: datetime | None
    created_at: datetime


# ── Workforce ───────────────────────────────────────────────────────────────

class AssignAdminRole(BaseModel):
    user_id: uuid.UUID
    admin_role: str


class PromoteUser(BaseModel):
    user_id: uuid.UUID
    admin_role: str
