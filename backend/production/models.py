"""Gold production: batches, their QR-coded passport, and the custody chain."""
import uuid

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from miners.models import Concession, Miner


class SecurityStatus(models.TextChoices):
    NORMAL = "normal", "Normal"
    FLAGGED = "flagged", "Flagged"
    MISSING = "missing", "Reported missing"
    STOLEN = "stolen", "Reported stolen"
    RECOVERED = "recovered", "Recovered"


class BatchStatus(models.TextChoices):
    CREATED = "created", "Created at source"
    ASSAYED = "assayed", "Assayed"
    IN_TRANSIT = "in_transit", "In transit"
    REFINED = "refined", "Refined"
    EXPORTED = "exported", "Exported"


def make_batch_code():
    return f"GH-{uuid.uuid4().hex[:10].upper()}"


class GoldBatch(TimeStampedModel):
    """Every gram of gold enters the system as a batch with a unique passport."""

    batch_code = models.CharField(max_length=24, unique=True, default=make_batch_code, editable=False)
    miner = models.ForeignKey(Miner, on_delete=models.PROTECT, related_name="batches")
    concession = models.ForeignKey(
        Concession, null=True, blank=True, on_delete=models.SET_NULL, related_name="batches",
    )

    gross_weight_g = models.DecimalField(max_digits=12, decimal_places=3)
    fine_weight_g = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    fineness = models.PositiveIntegerField(null=True, blank=True, help_text="Purity in parts per 1000 (e.g. 995).")

    status = models.CharField(max_length=12, choices=BatchStatus.choices, default=BatchStatus.CREATED, db_index=True)
    security_status = models.CharField(max_length=12, choices=SecurityStatus.choices, default=SecurityStatus.NORMAL, db_index=True)
    listed_for_sale = models.BooleanField(default=False, db_index=True)
    asking_price_ghs = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    seal_number = models.CharField(max_length=40, blank=True)
    origin_latitude = models.FloatField(null=True, blank=True)
    origin_longitude = models.FloatField(null=True, blank=True)
    field_notes = models.TextField(blank=True, default="")
    source_point = models.JSONField(default=dict, blank=True, help_text="GeoJSON Point of extraction.")

    qr_image = models.ImageField(upload_to="batch_qr/%Y/%m/", null=True, blank=True)
    passport_hash = models.CharField(max_length=64, blank=True, db_index=True)
    anchored_tx = models.CharField(max_length=128, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="created_batches",
    )
    current_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="owned_batches",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name_plural = "gold batches"

    def __str__(self):
        return f"{self.batch_code} ({self.gross_weight_g} g)"


class CustodyEventType(models.TextChoices):
    ORIGIN = "origin", "Origin / creation"
    TRANSFER = "transfer", "Ownership transfer"
    ASSAY = "assay", "Assay"
    REFINE = "refine", "Refining"
    EXPORT = "export", "Export"
    CUSTOMS = "customs", "Customs clearance"


class CustodyEvent(TimeStampedModel):
    """An immutable link in the chain of custody; its hash is anchored on-ledger."""

    batch = models.ForeignKey(GoldBatch, on_delete=models.CASCADE, related_name="custody_events")
    event_type = models.CharField(max_length=12, choices=CustodyEventType.choices)
    from_party = models.CharField(max_length=160, blank=True)
    to_party = models.CharField(max_length=160, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="custody_events",
    )
    location = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    event_hash = models.CharField(max_length=64, blank=True, db_index=True)
    previous_hash = models.CharField(max_length=64, blank=True)
    anchored_tx = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.batch.batch_code}:{self.event_type}"


class AssayMethod(models.TextChoices):
    XRF = "xrf", "XRF"
    FIRE = "fire_assay", "Fire assay"


def make_assay_no():
    import uuid
    return f"ASSAY-{uuid.uuid4().hex[:8].upper()}"


class Assay(TimeStampedModel):
    """A recorded assay: the authoritative measure of weight and purity."""

    batch = models.OneToOneField(GoldBatch, on_delete=models.CASCADE, related_name="assay")
    assayer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assays")
    method = models.CharField(max_length=12, choices=AssayMethod.choices, default=AssayMethod.XRF)
    gross_weight_g = models.DecimalField(max_digits=12, decimal_places=3)
    fine_weight_g = models.DecimalField(max_digits=12, decimal_places=3)
    fineness = models.PositiveSmallIntegerField(help_text="Parts per 1000")
    certificate_no = models.CharField(max_length=24, unique=True, default=make_assay_no, editable=False)
    remarks = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"{self.certificate_no} · {self.batch.batch_code} ({self.fineness}‰)"
