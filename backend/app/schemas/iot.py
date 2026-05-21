from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DeviceCreate(BaseModel):
    serial_number:    str
    imei:             str | None = None
    firmware_version: str | None = None


class DeviceUpdate(BaseModel):
    truck_id:         uuid.UUID | None = None
    status:           str | None = None
    firmware_version: str | None = None
    signal_strength:  int | None = None
    battery_level:    float | None = None
    tamper_flag:      bool | None = None
    tamper_reason:    str | None = None


class DeviceOut(BaseModel):
    id:                   uuid.UUID
    serial_number:        str
    imei:                 str | None
    firmware_version:     str | None
    status:               str
    truck_id:             uuid.UUID | None
    installed_by:         uuid.UUID | None
    installed_at:         datetime | None
    signal_strength:      int | None
    battery_level:        float | None
    last_heartbeat_at:    datetime | None
    tamper_flag:          bool
    tamper_reason:        str | None
    provisioning_secret:  str | None
    provisioned_at:       datetime | None
    created_at:           datetime
    updated_at:           datetime
    truck_registration:   str | None = None

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id:                uuid.UUID
    tracker_device_id: uuid.UUID | None
    truck_id:          uuid.UUID | None
    alert_type:        str
    severity:          str
    message:           str
    resolved_at:       datetime | None
    created_at:        datetime
    truck_registration: str | None = None
    device_serial:      str | None = None

    class Config:
        from_attributes = True


class AlertResolve(BaseModel):
    pass


class IoTTaskCreate(BaseModel):
    truck_id:  uuid.UUID
    owner_id:  uuid.UUID
    task_type: str  # install | replacement | re_verification
    location:  str | None = None
    deadline:  datetime | None = None
    notes:     str | None = None


class IoTDashboardOut(BaseModel):
    device_health:   dict[str, Any]
    tasks:           dict[str, Any]
    alerts_summary:  dict[str, Any]
    recent_alerts:   list[AlertOut]
