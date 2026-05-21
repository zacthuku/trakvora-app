from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog


async def log_activity(
    db: AsyncSession,
    action: str,
    summary: str,
    actor=None,
    resource_type: str | None = None,
    resource_id=None,
    meta: dict | None = None,
) -> None:
    """Add an ActivityLog entry to the current session. Caller owns the commit."""
    db.add(ActivityLog(
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "full_name", None) if actor else None,
        actor_role=actor.admin_role.value if actor and getattr(actor, "admin_role", None) else None,
        action=action,
        summary=summary,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        meta=meta,
    ))
