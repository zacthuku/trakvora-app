import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.database import get_db
from app.models.user import AdminRole, UserRole
from app.repositories.user_repo import UserRepository

# auto_error=False so FastAPI doesn't auto-return 403; we raise 401 ourselves
bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
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


def require_financial_access():
    """
    Dependency that blocks owner_user from financial endpoints (wallet, payouts, commissions).
    Only owner (full), admin, and shipper roles can access financials.
    """
    async def _check(current_user=Depends(get_current_user)):
        if current_user.role == UserRole.owner_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Financial access is restricted to fleet owners. Contact your account owner.",
            )
        return current_user
    return _check


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional["User"]:
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        return None
    return await UserRepository(db).get_by_id(uuid.UUID(payload["sub"]))


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
