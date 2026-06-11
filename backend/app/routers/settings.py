from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.country_config import CountryConfig
from app.models.load import Load
from app.models.platform_config import PlatformConfig
from app.models.platform_profile import PlatformProfile
from app.models.shipment import Shipment
from app.models.user import User, UserRole

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


# ── Company / Public Profile ───────────────────────────────────────────────────

class PlatformProfileOut(BaseModel):
    tagline:                  str
    subtitle:                 str
    hq_city:                  str
    founded_year:             int
    mission_headline:         str
    mission_body:             str
    show_stats_section:       bool = False
    show_testimonials_section: bool = False
    model_config = {"from_attributes": True}


class TeamMemberOut(BaseModel):
    id:                str
    full_name:         str
    job_title:         str | None
    bio:               str | None
    admin_role:        str | None
    profile_photo_url: str | None
    model_config = {"from_attributes": True}



@router.get("/company-profile")
async def get_company_profile(db: AsyncSession = Depends(get_db)):
    """Public — no auth. Returns platform profile + team members + real computed stats."""
    profile = await db.get(PlatformProfile, 1)
    if not profile:
        profile = PlatformProfile()

    team_rows = (await db.execute(
        select(User).where(
            User.role == UserRole.admin,
            User.show_on_team_page == True,   # noqa: E712
            User.is_active == True,           # noqa: E712
        ).order_by(User.created_at)
    )).scalars().all()

    team = [
        {
            "id":                str(u.id),
            "full_name":         u.full_name,
            "job_title":         u.job_title,
            "bio":               u.bio,
            # Return raw value (e.g. "super_admin") so frontend can group by dept
            "admin_role":        u.admin_role.value if u.admin_role else None,
            "profile_photo_url": u.profile_photo_url,
        }
        for u in team_rows
    ]

    # Real computed stats (replace the previously editable string fields)
    carriers = await db.scalar(
        select(func.count()).select_from(User).where(
            User.role.in_([UserRole.driver, UserRole.owner])
        )
    )
    stat_countries = await db.scalar(
        select(func.count(func.distinct(Load.corridor))).select_from(Load).where(
            Load.corridor.isnot(None)
        )
    )
    shipments = await db.scalar(
        select(func.count()).select_from(Shipment).where(
            Shipment.status == "delivered"
        )
    )

    # Active countries from CountryConfig (shown on public /company page)
    country_rows = (await db.execute(
        select(CountryConfig)
        .where(CountryConfig.is_active == True)  # noqa: E712
        .order_by(CountryConfig.country_name)
    )).scalars().all()

    return {
        "profile":        PlatformProfileOut.model_validate(profile),
        "team":           team,
        "computed_stats": {
            "carriers":  carriers       or 0,
            "countries": stat_countries or 0,
            "shipments": shipments      or 0,
        },
        "countries": [
            {
                "country_code":    c.country_code,
                "country_name":    c.country_name,
                "currency_code":   c.currency_code,
                "currency_symbol": c.currency_symbol,
                "phone_prefix":    c.phone_prefix,
            }
            for c in country_rows
        ],
    }


@router.get("/landing-assets")
async def get_landing_assets(db: AsyncSession = Depends(get_db)):
    """Public — no auth. Returns active landing section images (e.g. How It Works)."""
    from app.models.landing_asset import LandingAsset

    rows = (await db.execute(
        select(LandingAsset).where(LandingAsset.is_active.is_(True))
    )).scalars().all()

    return [{"key": r.key, "file_url": r.file_url, "alt_text": r.alt_text} for r in rows]


@router.get("/hero-slides")
async def get_hero_slides(
    country: str = Query("KE", description="ISO-2 country code for country-specific slides"),
    db: AsyncSession = Depends(get_db),
):
    """
    Public: return active hero slides for the given country.
    Returns global slides (country_code=null) + country-specific slides, ordered by sort_order.
    If no slides exist, returns an empty list — frontend falls back to hardcoded defaults.
    """
    from app.models.hero_slide import HeroSlide

    rows = (await db.execute(
        select(HeroSlide).where(
            HeroSlide.is_active.is_(True),
            or_(HeroSlide.country_code.is_(None), HeroSlide.country_code == country.upper()),
        ).order_by(HeroSlide.sort_order.asc())
    )).scalars().all()

    return [
        {
            "id":                 str(row.id),
            "headline":           row.headline,
            "highlight_word":     row.highlight_word,
            "description":        row.description,
            "image_type":         row.image_type,
            "cta_primary_text":   row.cta_primary_text,
            "cta_primary_url":    row.cta_primary_url,
            "cta_secondary_text": row.cta_secondary_text,
            "cta_secondary_url":  row.cta_secondary_url,
            "sort_order":         row.sort_order,
            "country_code":       row.country_code,
        }
        for row in rows
    ]
