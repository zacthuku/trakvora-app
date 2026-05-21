from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

import uuid

from app.core.security import decode_token
from app.database import get_db
from app.models.user import AdminRole, UserRole
from app.repositories.user_repo import UserRepository

bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await UserRepository(db).get_by_id(uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(*roles: str):
    async def _check(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return _check


def require_admin_role(*admin_roles: AdminRole):
    """Requires role=admin AND admin_role in the given set.
    Users with admin_role=None or admin_role=super_admin bypass the sub-role check."""
    async def _check(current_user=Depends(get_current_user)):
        if current_user.role != UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        is_super = (
            current_user.admin_role is None
            or current_user.admin_role == AdminRole.super_admin
        )
        if not is_super and current_user.admin_role not in admin_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient admin privileges")
        return current_user
    return _check
