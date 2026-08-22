"""Export certification: a verifiable, QR-coded certificate for a gold batch."""
import uuid

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from production.models import GoldBatch


class CertificateStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ISSUED = "issued", "Issued"
    REVOKED = "revoked", "Revoked"


def make_certificate_number():
    return f"GHEX-{uuid.uuid4().hex[:8].upper()}"


class ExportCertificate(TimeStampedModel):
    batch = models.ForeignKey(GoldBatch, on_delete=models.PROTECT, related_name="export_certificates")
    exporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="export_certificates",
    )
    certificate_number = models.CharField(
        max_length=24, unique=True, default=make_certificate_number, editable=False,
    )
    destination_country = models.CharField(max_length=80)
    fine_weight_g = models.DecimalField(max_digits=12, decimal_places=3)
    fineness = models.PositiveIntegerField(null=True, blank=True)

    status = models.CharField(
        max_length=10, choices=CertificateStatus.choices, default=CertificateStatus.DRAFT, db_index=True,
    )
    certificate_hash = models.CharField(max_length=64, blank=True, db_index=True)
    anchored_tx = models.CharField(max_length=128, blank=True)
    qr_image = models.ImageField(upload_to="export_qr/%Y/%m/", null=True, blank=True)

    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="issued_certificates",
    )
    issued_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.certificate_number} ({self.get_status_display()})"
