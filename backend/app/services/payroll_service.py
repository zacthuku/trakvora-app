"""
Kenya payroll tax calculations (FY 2024/2025).

PAYE bands (monthly): Finance Act 2023
  0 – 24,000         : 10%
  24,001 – 32,333    : 25%
  32,334 – 500,000   : 30%
  500,001 – 800,000  : 32.5%
  800,001+            : 35%
  Personal relief     : KES 2,400/month

SHIF (Social Health Insurance Fund): 2.75% of gross, no cap
NSSF: 6% of gross, employee portion capped at KES 1,080/month
"""
from decimal import Decimal, ROUND_HALF_UP


def _d(n) -> Decimal:
    return Decimal(str(n)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_paye(gross_monthly: float) -> float:
    g = float(gross_monthly)
    if g <= 0:
        return 0.0

    # PAYE on monthly gross
    if g <= 24_000:
        tax = g * 0.10
    elif g <= 32_333:
        tax = 24_000 * 0.10 + (g - 24_000) * 0.25
    elif g <= 500_000:
        tax = 24_000 * 0.10 + 8_333 * 0.25 + (g - 32_333) * 0.30
    elif g <= 800_000:
        tax = 24_000 * 0.10 + 8_333 * 0.25 + 467_667 * 0.30 + (g - 500_000) * 0.325
    else:
        tax = 24_000 * 0.10 + 8_333 * 0.25 + 467_667 * 0.30 + 300_000 * 0.325 + (g - 800_000) * 0.35

    personal_relief = 2_400.0
    paye = max(0.0, tax - personal_relief)
    return float(_d(paye))


def calculate_shif(gross_monthly: float) -> float:
    """Social Health Insurance Fund — 2.75% of gross."""
    return float(_d(max(0.0, float(gross_monthly)) * 0.0275))


def calculate_nssf(gross_monthly: float) -> float:
    """NSSF employee contribution — 6% of gross, capped at KES 1,080."""
    return float(_d(min(float(gross_monthly) * 0.06, 1_080.0)))


def compute_deductions(gross_monthly: float) -> dict:
    paye = calculate_paye(gross_monthly)
    shif = calculate_shif(gross_monthly)
    nssf = calculate_nssf(gross_monthly)
    net  = float(_d(float(gross_monthly) - paye - shif - nssf))
    return {
        "paye_kes": paye,
        "shif_kes": shif,
        "nssf_kes": nssf,
        "net_pay_kes": max(0.0, net),
    }
