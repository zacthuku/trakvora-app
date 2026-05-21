from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services import email_service, notification_service
from app.services.activity_service import log_activity

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoRequestSchema(BaseModel):
    role:           str            = Field(..., min_length=1)
    company:        str            = Field(..., min_length=1, max_length=200)
    fleet_size:       str | None     = None
    monthly_shipments: str | None   = None
    name:           str            = Field(..., min_length=1, max_length=200)
    email:          EmailStr
    phone:          str            = Field(..., min_length=1, max_length=50)
    country:        str            = Field(..., min_length=1)
    features:       list[str]      = Field(..., min_length=1)
    preferred_time: str            = Field(..., min_length=1)
    notes:          str | None     = Field(None, max_length=2000)


@router.post("/request", status_code=status.HTTP_202_ACCEPTED)
async def request_demo(payload: DemoRequestSchema, db: AsyncSession = Depends(get_db)) -> dict:
    await email_service.send_demo_request_internal(
        lead=payload.model_dump(),
        support_email=settings.support_email,
    )
    await email_service.send_demo_confirmation(
        to_email=payload.email,
        name=payload.name,
    )
    await log_activity(
        db,
        action="demo_requested",
        summary=f"Demo requested by {payload.name} ({payload.email}) — role: {payload.role}",
        meta={"company": payload.company, "role": payload.role,
              "fleet_size": payload.fleet_size, "monthly_shipments": payload.monthly_shipments},
    )
    await notification_service.notify_all_admins(
        db,
        title="New Demo Request",
        body=f"{payload.name} from {payload.company} requested a demo ({payload.role})",
        roles=["super_admin", "operations_admin"],
    )
    await db.commit()
    return {"message": "Demo request received"}
