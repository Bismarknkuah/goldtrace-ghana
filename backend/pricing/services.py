from decimal import Decimal

from django.conf import settings

from .models import ReferenceRate


def current_rate() -> Decimal:
    """Latest Bank of Ghana reference rate (GHS per gram fine gold)."""
    rr = ReferenceRate.objects.order_by("-effective_date", "-created_at").first()
    if rr:
        return rr.rate_ghs_per_g
    return Decimal(str(settings.GOLD_PRICE_GHS_PER_G))
