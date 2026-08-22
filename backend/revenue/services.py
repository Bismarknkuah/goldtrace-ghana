"""Government revenue: export valuation and statutory mineral royalty.

Value of an export = fine gold weight (g) x gold price (GHS/g).
Royalty = value x the statutory mineral royalty rate (Ghana: 5%).
Both the gold price and the rate are configurable in settings.
"""
from decimal import ROUND_HALF_UP, Decimal


def _money(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def export_value_ghs(fine_weight_g, price_per_g) -> Decimal:
    return _money(Decimal(str(fine_weight_g or 0)) * Decimal(str(price_per_g)))


def royalty_ghs(value, rate) -> Decimal:
    return _money(Decimal(str(value)) * Decimal(str(rate)))
