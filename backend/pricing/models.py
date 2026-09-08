"""Bank of Ghana reference-rate pricing.

GoldBod directs licensed traders to transact off the Bank of Ghana Reference
Rate. Rates are recorded with an effective date; the latest one prices gold.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel


class ReferenceRate(TimeStampedModel):
    rate_ghs_per_g = models.DecimalField(max_digits=12, decimal_places=2)
    effective_date = models.DateField(default=timezone.now)
    source = models.CharField(max_length=120, default="Bank of Ghana Reference Rate")
    set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="reference_rates")

    class Meta(TimeStampedModel.Meta):
        ordering = ["-effective_date", "-created_at"]

    def __str__(self):
        return f"{self.rate_ghs_per_g} GHS/g @ {self.effective_date}"
