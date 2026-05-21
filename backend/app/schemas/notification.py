import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    model_config = {"from_attributes": True}

    id:                uuid.UUID
    notification_type: str
    title:             str
    body:              str
    is_read:           bool
    reference_id:      uuid.UUID | None
    reference_type:    str | None
    created_at:        datetime
