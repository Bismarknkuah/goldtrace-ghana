"""GoldBod licensing — the authorization backbone for every participant.

Mirrors the licence categories issued under the Ghana Gold Board Act, 2025:
tier-1/tier-2 buyers, aggregators, refiners, transporters, storage, and more.
A public License Registry lets anyone verify that an operator is licensed.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel


class LicenseType(models.TextChoices):
    TIER1_BUYER = "tier1_buyer", "Tier 1 Buyer"
    TIER2_BUYER = "tier2_buyer", "Tier 2 Buyer"
    AGGREGATOR = "aggregator", "Aggregator"
    SELF_FINANCING_AGGREGATOR = "self_financing_aggregator", "Self-financing Aggregator"
    REFINER = "refiner", "Refiner"
    JEWELLER = "jeweller", "Jeweller / Fabricator"
    SMELTER = "smelter", "Smelter"
    TRANSPORTER = "transporter", "Transporter (bullion)"
    STORAGE = "storage", "Storage / Vault"
    IMPORTER = "importer", "Importer"
    EXPORTER = "exporter", "Exporter"


class LicenseStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    REVOKED = "revoked", "Revoked"
    EXPIRED = "expired", "Expired"


_CODE = {
    "tier1_buyer": "T1", "tier2_buyer": "T2", "aggregator": "AG",
    "self_financing_aggregator": "SA", "refiner": "RF", "jeweller": "JW",
    "smelter": "SM", "transporter": "TR", "storage": "ST",
    "importer": "IM", "exporter": "EX",
}


def make_license_number(license_type: str) -> str:
    return f"GB-{_CODE.get(license_type, 'GN')}-{timezone.now().year}-{uuid.uuid4().hex[:5].upper()}"


class License(TimeStampedModel):
    holder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="licenses")
    license_type = models.CharField(max_length=32, choices=LicenseType.choices, db_index=True)
    license_number = models.CharField(max_length=32, unique=True, blank=True)
    status = models.CharField(max_length=10, choices=LicenseStatus.choices,
                              default=LicenseStatus.ACTIVE, db_index=True)
    region = models.CharField(max_length=80, blank=True)
    operating_areas = models.CharField(max_length=200, blank=True)
    working_capital_ghs = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    trade_capital_ghs = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    expires_at = models.DateField(null=True, blank=True)
    renewal_requested = models.BooleanField(default=False)
    renewal_document = models.TextField(blank=True, default="")  # base64 upload
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="licenses_issued")

    def save(self, *args, **kwargs):
        if not self.license_number:
            self.license_number = make_license_number(self.license_type)
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        if self.status != LicenseStatus.ACTIVE:
            return False
        return self.expires_at is None or self.expires_at >= timezone.now().date()

    def __str__(self):
        return f"{self.license_number} ({self.get_license_type_display()})"
