import uuid
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> User | None:
        result = await self.db.execute(select(User).where(User.phone == phone))
        return result.scalar_one_or_none()

    async def get_by_national_id(self, national_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.national_id == national_id))
        return result.scalar_one_or_none()

    async def get_by_kra_pin(self, kra_pin: str) -> User | None:
        result = await self.db.execute(select(User).where(User.kra_pin == kra_pin))
        return result.scalar_one_or_none()

    async def get_banned_with_matching_identifiers(
        self,
        email: str | None = None,
        phone: str | None = None,
        national_id: str | None = None,
        kra_pin: str | None = None,
    ) -> list[User]:
        """Returns banned users whose ban_snapshot matches any of the provided identifiers."""
        from sqlalchemy import cast, String
        from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB

        conditions = []
        if email:
            conditions.append(User.ban_snapshot["email"].as_string() == email)
        if phone:
            conditions.append(User.ban_snapshot["phone"].as_string() == phone)
        if national_id:
            conditions.append(User.ban_snapshot["national_id"].as_string() == national_id)
        if kra_pin:
            conditions.append(User.ban_snapshot["kra_pin"].as_string() == kra_pin)

        if not conditions:
            return []

        result = await self.db.execute(
            select(User).where(User.is_banned.is_(True), or_(*conditions))
        )
        return result.scalars().all()

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            if value is not None:
                setattr(user, key, value)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def soft_delete(self, user: User, reason: str = "user_requested") -> None:
        user.is_active = False
        user.deleted_at = datetime.now(timezone.utc)
        user.deleted_reason = reason
        await self.db.flush()

    async def delete(self, user: User) -> None:
        await self.db.delete(user)
        await self.db.flush()
