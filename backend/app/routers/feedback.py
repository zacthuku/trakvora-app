import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models.feedback import Feedback
from app.models.user import User, UserRole
from app.services.notification_service import notify_all_admins

router = APIRouter(tags=["feedback"])

# Maps feedback_type → admin roles that handle it
FEEDBACK_ROLE_MAP: dict[str, list[str]] = {
    "Payment Issue":   ["finance_admin"],
    "Feature Request": ["operations_admin", "super_admin"],
    "Bug Report":      ["operations_admin", "super_admin"],
    "Integration":     ["operations_admin", "super_admin"],
    "Performance":     ["operations_admin", "super_admin"],
    "General":         ["support_agent"],
    "Onboarding":      ["support_agent"],
    "Other":           ["support_agent"],
}


class FeedbackIn(BaseModel):
    name: str
    email: EmailStr
    company_name: Optional[str] = None
    role: Optional[str] = None
    feedback_type: Optional[str] = None
    message: str
    rating: Optional[int] = None


class FeedbackOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    company_name: Optional[str]
    role: Optional[str]
    feedback_type: Optional[str]
    message: str
    rating: Optional[int]
    is_featured: bool

    model_config = {"from_attributes": True}


class TestimonialOut(BaseModel):
    id: uuid.UUID
    name: str
    company_name: Optional[str]
    role: Optional[str]
    message: str

    model_config = {"from_attributes": True}


@router.post("/feedback", status_code=201)
async def submit_feedback(body: FeedbackIn, db: AsyncSession = Depends(get_db)):
    if body.rating is not None and not (1 <= body.rating <= 5):
        raise HTTPException(status_code=422, detail="rating must be between 1 and 5")

    fb = Feedback(**body.model_dump())
    db.add(fb)
    await db.commit()
    await db.refresh(fb)

    roles = FEEDBACK_ROLE_MAP.get(body.feedback_type or "", ["support_agent"])
    company_str = body.company_name or "no company"
    preview = body.message[:120] + ("…" if len(body.message) > 120 else "")
    await notify_all_admins(
        db,
        title=f"New {body.feedback_type or 'general'} feedback",
        body=f"{body.name} ({company_str}): \"{preview}\"",
        roles=roles,
        reference_id=fb.id,
        reference_type="feedback",
    )

    return {"message": "Thank you for your feedback!"}


@router.get("/testimonials", response_model=list[TestimonialOut])
async def list_testimonials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Feedback)
        .where(Feedback.is_featured == True)  # noqa: E712
        .order_by(Feedback.created_at.desc())
    )
    return result.scalars().all()


@router.get("/feedback", response_model=list[FeedbackOut])
async def list_all_feedback(
    _: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Feedback).order_by(Feedback.created_at.desc()))
    return result.scalars().all()


@router.patch("/feedback/{feedback_id}/feature")
async def toggle_feature(
    feedback_id: uuid.UUID,
    featured: bool,
    _: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    fb = await db.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    fb.is_featured = featured
    await db.commit()
    return {"id": feedback_id, "is_featured": featured}
