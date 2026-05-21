import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.otp import EmailOTP


class OTPRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, email: str) -> str:
        # Invalidate all previous unused OTPs for this email
        await self.db.execute(
            update(EmailOTP)
            .where(and_(EmailOTP.email == email, EmailOTP.is_used == False))
            .values(is_used=True)
        )
        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        otp = EmailOTP(email=email, code=code, expires_at=expires_at)
        self.db.add(otp)
        await self.db.commit()
        return code

    async def verify(self, email: str, code: str) -> bool:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(EmailOTP)
            .where(
                and_(
                    EmailOTP.email == email,
                    EmailOTP.code == code,
                    EmailOTP.is_used == False,
                    EmailOTP.expires_at > now,
                )
            )
            .order_by(EmailOTP.created_at.desc())
            .limit(1)
        )
        otp = result.scalar_one_or_none()
        if not otp:
            return False
        otp.is_used = True
        await self.db.commit()
        return True
