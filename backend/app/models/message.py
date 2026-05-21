import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MessageType(str, enum.Enum):
    invite_accepted = "invite_accepted"
    general         = "general"


class Message(Base):
    __tablename__ = "messages"

    sender_id:    Mapped[uuid.UUID]   = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipient_id: Mapped[uuid.UUID]   = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    subject:      Mapped[str]         = mapped_column(String(255), nullable=False)
    body:         Mapped[str]         = mapped_column(Text, nullable=False)
    is_read:      Mapped[bool]        = mapped_column(Boolean, default=False)
    message_type: Mapped[MessageType] = mapped_column(
        Enum(MessageType, name="messagetype"), nullable=False, default=MessageType.general
    )

    sender    = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
