import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.repositories.notification_repo import NotificationRepository

_TRACKING_CONNECTIONS: dict[str, list] = {}


async def send_notification(
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    body: str,
    reference_id: uuid.UUID | None = None,
    reference_type: str | None = None,
    db: AsyncSession | None = None,
) -> None:
    if db:
        repo = NotificationRepository(db)
        await repo.create(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            reference_id=reference_id,
            reference_type=reference_type,
        )
        # Also fire FCM push if the user has a registered device token
        try:
            from app.services.push_service import send_push_to_user
            data = {}
            if reference_id:
                data["reference_id"] = str(reference_id)
            if reference_type:
                data["reference_type"] = reference_type
            await send_push_to_user(user_id, title, body, data, db)
        except Exception:  # noqa: BLE001
            pass  # push is non-critical; DB notification already stored


async def notify_all_admins(
    db: AsyncSession,
    title: str,
    body: str,
    roles: list[str] | None = None,
    reference_id: uuid.UUID | None = None,
    reference_type: str | None = None,
) -> None:
    """Send a system notification to all active admins (optionally filtered by admin_role)."""
    from app.models.user import AdminRole, User, UserRole  # local import to avoid circular deps
    q = select(User).where(User.role == UserRole.admin, User.is_active == True)  # noqa: E712
    if roles:
        valid_roles = [AdminRole(r) for r in roles if r in AdminRole._value2member_map_]
        if valid_roles:
            q = q.where(User.admin_role.in_(valid_roles))
    admins = (await db.execute(q)).scalars().all()
    repo = NotificationRepository(db)
    for admin in admins:
        await repo.create(
            user_id=admin.id,
            notification_type=NotificationType.system,
            title=title,
            body=body,
            reference_id=reference_id,
            reference_type=reference_type,
            is_admin_notification=True,
        )


def register_tracking_connection(shipment_id: str, websocket) -> None:
    if shipment_id not in _TRACKING_CONNECTIONS:
        _TRACKING_CONNECTIONS[shipment_id] = []
    _TRACKING_CONNECTIONS[shipment_id].append(websocket)


def unregister_tracking_connection(shipment_id: str, websocket) -> None:
    if shipment_id in _TRACKING_CONNECTIONS:
        _TRACKING_CONNECTIONS[shipment_id].discard(websocket) if hasattr(
            _TRACKING_CONNECTIONS[shipment_id], "discard"
        ) else _TRACKING_CONNECTIONS[shipment_id].remove(websocket)


async def broadcast_location(shipment_id: str, data: dict) -> None:
    import json

    connections = _TRACKING_CONNECTIONS.get(shipment_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            _TRACKING_CONNECTIONS[shipment_id].remove(ws)
        except ValueError:
            pass
