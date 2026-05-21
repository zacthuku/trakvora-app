import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TaskStatus(str, enum.Enum):
    pending     = "pending"
    in_progress = "in_progress"
    submitted   = "submitted"
    completed   = "completed"
    cancelled   = "cancelled"


class TaskType(str, enum.Enum):
    inspection      = "inspection"
    install         = "install"
    replacement     = "replacement"
    re_verification = "re_verification"


class InspectionTask(Base):
    __tablename__ = "inspection_tasks"

    truck_id:     Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("trucks.id"), nullable=False)
    owner_id:     Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_to:  Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status:       Mapped[TaskStatus]       = mapped_column(Enum(TaskStatus, name="taskstatus"), default=TaskStatus.pending)
    task_type:    Mapped[TaskType]         = mapped_column(Enum(TaskType, native_enum=False), default=TaskType.inspection)
    location:     Mapped[str | None]       = mapped_column(String(255))
    location_lat: Mapped[float | None]     = mapped_column(Float)
    location_lon: Mapped[float | None]     = mapped_column(Float)
    deadline:     Mapped[datetime | None]  = mapped_column(DateTime(timezone=True))
    assigned_at:  Mapped[datetime | None]  = mapped_column(DateTime(timezone=True))
    notes:        Mapped[str | None]       = mapped_column(Text)

    truck              = relationship("Truck", foreign_keys=[truck_id])
    owner              = relationship("User",  foreign_keys=[owner_id])
    assigned_inspector = relationship("User",  foreign_keys=[assigned_to])
