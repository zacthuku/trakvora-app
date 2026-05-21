import uuid
from datetime import datetime

from pydantic import BaseModel


class MessageOut(BaseModel):
    model_config = {"from_attributes": True}

    id:           uuid.UUID
    sender_id:    uuid.UUID
    recipient_id: uuid.UUID
    subject:      str
    body:         str
    is_read:      bool
    message_type: str
    created_at:   datetime
    sender_name:  str | None = None


class UnreadCountOut(BaseModel):
    count: int
