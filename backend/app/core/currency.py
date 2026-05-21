from __future__ import annotations

from app.models.user import User


COUNTRY_CURRENCY: dict[str, str] = {
    "KE": "KES",
    "UG": "UGX",
    "TZ": "TZS",
    "RW": "RWF",
    "NG": "NGN",
    "GH": "GHS",
    "ZA": "ZAR",
    "US": "USD",
    "GB": "GBP",
    "EU": "EUR",
}

COUNTRY_PAYMENT_OPTIONS: dict[str, str] = {
    "KE": "card,mobilemoney",
    "UG": "card,mobilemoney",
    "TZ": "card,mobilemoney",
    "RW": "card,mobilemoney",
    "GH": "card,mobilemoney",
    "NG": "card,banktransfer,ussd",
}

DEFAULT_COUNTRY = "KE"
DEFAULT_CURRENCY = "KES"


def normalize_country(country: str | None) -> str:
    if not country:
        return DEFAULT_COUNTRY
    country = country.strip().upper()
    return country if len(country) == 2 and country.isalpha() else DEFAULT_COUNTRY


def currency_for_country(country: str | None) -> str:
    return COUNTRY_CURRENCY.get(normalize_country(country), DEFAULT_CURRENCY)


def currency_for_user(user: User) -> str:
    return currency_for_country(getattr(user, "country", None))


def flutterwave_payment_options_for_country(country: str | None) -> str:
    return COUNTRY_PAYMENT_OPTIONS.get(normalize_country(country), "card")
