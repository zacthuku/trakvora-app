import uuid

from sqlalchemy import Index, JSON, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    # id, created_at, updated_at come from Base
    actor_id:      Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    actor_name:    Mapped[str | None]       = mapped_column(String(200), nullable=True)
    actor_role:    Mapped[str | None]       = mapped_column(String(50),  nullable=True)
    action:        Mapped[str]              = mapped_column(String(60),  nullable=False)
    resource_type: Mapped[str | None]       = mapped_column(String(50),  nullable=True)
    resource_id:   Mapped[str | None]       = mapped_column(String(36),  nullable=True)
    summary:       Mapped[str]              = mapped_column(String(500), nullable=False)
    meta:          Mapped[dict | None]      = mapped_column(JSON,        nullable=True)

    __table_args__ = (
        Index("ix_activity_logs_actor_id",   "actor_id"),
        Index("ix_activity_logs_action",     "action"),
        Index("ix_activity_logs_created_at", "created_at"),
    )
