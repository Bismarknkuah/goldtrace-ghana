"""Licensed miner registration, concessions and supporting documents."""
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class LicenseStatus(models.TextChoices):
    PENDING = "pending", "Pending review"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    REVOKED = "revoked", "Revoked"
    EXPIRED = "expired", "Expired"


class Miner(TimeStampedModel):
    """A licensed small- or large-scale miner registered with GoldBod."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="miner_profile",
    )
    license_number = models.CharField(max_length=40, unique=True)
    license_status = models.CharField(
        max_length=12, choices=LicenseStatus.choices, default=LicenseStatus.PENDING, db_index=True,
    )
    license_expiry = models.DateField(null=True, blank=True)
    region = models.CharField(max_length=80)
    district = models.CharField(max_length=80, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="verified_miners",
    )
    company = models.ForeignKey(
        "MiningCompany", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="miners",
    )

    def __str__(self):
        return f"{self.license_number} — {self.user.get_full_name() or self.user.username}"


class Concession(TimeStampedModel):
    """A mining concession with a GeoJSON boundary (indexed 2dsphere in Atlas)."""

    miner = models.ForeignKey(Miner, on_delete=models.CASCADE, related_name="concessions")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=40, unique=True)
    region = models.CharField(max_length=80)
    area_hectares = models.FloatField(default=0.0)
    # GeoJSON Polygon: {"type": "Polygon", "coordinates": [[[lng, lat], ...]]}
    boundary = models.JSONField(default=dict, blank=True)
    centroid_lat = models.FloatField(null=True, blank=True)
    centroid_lng = models.FloatField(null=True, blank=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} — {self.name}"


class DocumentType(models.TextChoices):
    LICENSE = "license", "Mining licence"
    ENV_PERMIT = "env_permit", "Environmental permit"
    ID = "id", "Identification"
    TAX = "tax", "Tax clearance"
    OTHER = "other", "Other"


class MinerDocument(TimeStampedModel):
    miner = models.ForeignKey(Miner, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=20, choices=DocumentType.choices)
    file = models.FileField(upload_to="miner_documents/%Y/%m/")
    note = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.get_doc_type_display()} for {self.miner.license_number}"


class MiningCompany(TimeStampedModel):
    """A corporate concession holder that may operate several licensed miners."""

    name = models.CharField(max_length=160)
    registration_no = models.CharField(max_length=40, unique=True)
    region = models.CharField(max_length=80, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name_plural = "mining companies"

    def __str__(self):
        return f"{self.name} ({self.registration_no})"
