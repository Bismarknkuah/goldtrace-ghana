"""Compliance: KYC/AML screening of parties and responsible-sourcing attestations."""
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from production.models import GoldBatch


class RiskRating(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class ScreeningStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CLEARED = "cleared", "Cleared"
    FLAGGED = "flagged", "Flagged for review"
    REJECTED = "rejected", "Rejected"


class KycScreening(TimeStampedModel):
    """A KYC/AML screening of a counterparty — especially international buyers."""

    subject_name = models.CharField(max_length=160)
    subject_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="kyc_screenings")
    country = models.CharField(max_length=80, blank=True)
    purpose = models.CharField(max_length=120, default="Buyer onboarding")

    sanctions_hit = models.BooleanField(default=False)
    pep = models.BooleanField(default=False)  # politically exposed person
    risk_rating = models.CharField(max_length=8, choices=RiskRating.choices, default=RiskRating.LOW)
    status = models.CharField(max_length=10, choices=ScreeningStatus.choices,
                              default=ScreeningStatus.PENDING, db_index=True)
    note = models.CharField(max_length=255, blank=True)
    screened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="screenings_performed")

    def __str__(self):
        return f"{self.subject_name}: {self.status}"


class DueDiligence(TimeStampedModel):
    """OECD-style responsible-sourcing attestation for a gold batch."""

    batch = models.OneToOneField(GoldBatch, on_delete=models.CASCADE, related_name="due_diligence")
    origin_verified = models.BooleanField(default=False)
    conflict_free = models.BooleanField(default=False)
    oecd_conformant = models.BooleanField(default=False)
    oecd_step = models.PositiveSmallIntegerField(default=1)  # OECD 5-step framework
    statement = models.CharField(max_length=255, blank=True)
    attested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="attestations")

    @property
    def responsible(self) -> bool:
        return self.origin_verified and self.conflict_free and self.oecd_conformant

    def __str__(self):
        return f"DD {self.batch.batch_code}: {'responsible' if self.responsible else 'pending'}"
