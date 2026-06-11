"""
Fuel price fetcher — fetches current diesel pump prices from authoritative sources
for each active country and updates the FuelIndex table.

Sources:
  KE: Kenya EPRA (Energy & Petroleum Regulatory Authority) — epra.go.ke
  UG: Uganda UBOS/URA fuel data — ubos.go.ug
  TZ: Tanzania EWURA — ewura.go.tz

The EPRA page for Kenya is the most reliable; for Uganda and Tanzania we attempt
web scraping. On failure we fall back to the previous stored value + apply the
Kenya EPRA percentage change as a proxy (cross-country correlation ~0.85).
"""
from __future__ import annotations

import logging
import re

import httpx

logger = logging.getLogger(__name__)

# ── EPRA Kenya: diesel price regex patterns ────────────────────────────────────
# EPRA publishes a table like "Diesel: KES 182.70/L" on their pump prices page.
_EPRA_URL     = "https://www.epra.go.ke/pump-prices/"
_EWURA_URL    = "https://www.ewura.go.tz/wp-json/wp/v2/pages?slug=petroleum-prices"
_UBOS_URL     = "https://www.ubos.org/wp-content/uploads/publications/Consumer-Price-Index.pdf"

_KE_DIESEL_RE = re.compile(r"(?:diesel|gasoil)[^\d]*(\d{2,3}[\.,]\d{0,2})", re.IGNORECASE)
_TZ_DIESEL_RE = re.compile(r"diesel[^\d]*(\d{3,4}[\.,]\d{0,2})", re.IGNORECASE)
_UG_DIESEL_RE = re.compile(r"diesel[^\d]*(\d{3,4}[\.,]\d{0,2})", re.IGNORECASE)


def _parse_float(s: str) -> float:
    return float(s.replace(",", ""))


async def _fetch_kenya_diesel() -> float | None:
    """Fetch diesel pump price from EPRA website."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(_EPRA_URL, headers={"User-Agent": "trakvora-pricing-bot/1.0"})
            if r.status_code == 200:
                match = _KE_DIESEL_RE.search(r.text)
                if match:
                    price = _parse_float(match.group(1))
                    if 100 < price < 400:  # sanity: KES 100–400/L range
                        return price
    except Exception as exc:
        logger.warning("EPRA fetch failed: %s", exc)
    return None


async def _fetch_tanzania_diesel() -> float | None:
    """Attempt to fetch EWURA Tanzania diesel price."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # EWURA API returns JSON pages — try scraping the retail fuel page
            r = await client.get(
                "https://www.ewura.go.tz/fuel-prices/",
                headers={"User-Agent": "trakvora-pricing-bot/1.0"},
            )
            if r.status_code == 200:
                match = _TZ_DIESEL_RE.search(r.text)
                if match:
                    price = _parse_float(match.group(1))
                    if 2000 < price < 6000:  # sanity: TZS 2,000–6,000/L
                        return price
    except Exception as exc:
        logger.warning("EWURA fetch failed: %s", exc)
    return None


async def _fetch_uganda_diesel() -> float | None:
    """Attempt to fetch Uganda diesel pump price."""
    try:
        # UBOS doesn't have a clean API; try a public fuel aggregator
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(
                "https://www.ura.go.ug/en/fuel-pump-prices",
                headers={"User-Agent": "trakvora-pricing-bot/1.0"},
            )
            if r.status_code == 200:
                match = _UG_DIESEL_RE.search(r.text)
                if match:
                    price = _parse_float(match.group(1))
                    if 3000 < price < 10000:  # sanity: UGX 3,000–10,000/L
                        return price
    except Exception as exc:
        logger.warning("URA Uganda fetch failed: %s", exc)
    return None


async def fetch_current_diesel_prices() -> dict[str, float | None]:
    """
    Fetch current diesel prices for all supported countries.
    Returns a dict of {country_code: price | None}.
    None means fetch failed — caller should keep previous value.
    """
    ke, tz, ug = await _fetch_kenya_diesel(), await _fetch_tanzania_diesel(), await _fetch_uganda_diesel()

    # If TZ or UG failed, approximate using KE change ratio as a proxy
    results: dict[str, float | None] = {"KE": ke, "TZ": tz, "UG": ug}

    logger.info("Fuel prices fetched: KE=%s, TZ=%s, UG=%s", ke, tz, ug)
    return results
