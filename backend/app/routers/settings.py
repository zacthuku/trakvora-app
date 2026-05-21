from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.country_config import CountryConfig
from app.models.platform_config import PlatformConfig

router = APIRouter(prefix="/settings", tags=["settings"])


class CountryConfigOut(BaseModel):
    country_code: str
    country_name: str
    currency_code: str
    currency_symbol: str
    vat_rate: float
    distance_unit: str
    date_format: str
    phone_prefix: str
    model_config = {"from_attributes": True}


class PlatformFeeOut(BaseModel):
    service_type: str
    commission_rate: float
    shipper_commission_rate: float | None
    carrier_commission_rate: float | None
    cancellation_fee_rate: float | None
    vat_rate: float
    min_commission_kes: float
    max_commission_kes: float | None
    model_config = {"from_attributes": True}


class CountrySettingsOut(BaseModel):
    country: CountryConfigOut
    platform_fees: list[PlatformFeeOut]


@router.get("/country", response_model=CountrySettingsOut)
async def get_country_settings(
    code: str = Query("KE", min_length=2, max_length=2),
    db: AsyncSession = Depends(get_db),
):
    """Public — no auth. Returns CountryConfig + active PlatformConfig rows for a country."""
    cc = (await db.execute(
        select(CountryConfig).where(
            CountryConfig.country_code == code.upper(),
            CountryConfig.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()

    if not cc:
        cc = (await db.execute(
            select(CountryConfig).where(CountryConfig.country_code == "KE")
        )).scalar_one_or_none()
        if not cc:
            raise HTTPException(status_code=404, detail="No country configuration found")

    fees = (await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.country_code == cc.country_code,
            PlatformConfig.is_active == True,  # noqa: E712
        )
    )).scalars().all()

    return {"country": cc, "platform_fees": fees}
