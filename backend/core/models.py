"""Shared abstract models and the immutable audit trail."""
from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Adds created/updated timestamps to every domain table."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class AuditLog(models.Model):
    """Append-only record of state-changing API actions (deliverable #14)."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="audit_entries",
    )
    actor_role = models.CharField(max_length=40, blank=True)
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255)
    status_code = models.PositiveIntegerField(default=0)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # Hash chain: each entry seals the one before it (immutable auditability).
    prev_hash = models.CharField(max_length=64, blank=True, default="")
    entry_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def compute_hash(self, prev_hash: str) -> str:
        import hashlib
        payload = f"{prev_hash}|{self.actor_id}|{self.actor_role}|{self.method}|"\
                  f"{self.path}|{self.status_code}|{self.ip_address}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def __str__(self):
        return f"{self.method} {self.path} -> {self.status_code}"


class RoleFeatures(models.Model):
    """Admin-managed feature visibility per role — lets the Super Admin add or
    remove menu features for any role without changing code."""
    role = models.CharField(max_length=32, unique=True, db_index=True)
    features = models.JSONField(default=list, blank=True)  # list of nav keys enabled
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.role}: {len(self.features)} features"


class SystemConfig(models.Model):
    """Single row of admin-editable operating settings (no code changes)."""
    org_name = models.CharField(max_length=120, default="Ghana Gold Board")
    tagline = models.CharField(max_length=200, default="National Digital Trust Platform")
    contact_email = models.EmailField(blank=True, default="")
    report_form_title = models.CharField(max_length=160, default="Report illegal mining to GoldBod")
    # Compliance thresholds
    risk_block_threshold = models.PositiveSmallIntegerField(default=70)   # lot risk >= -> block purchase
    risk_review_threshold = models.PositiveSmallIntegerField(default=45)  # lot risk >= -> human review
    mass_balance_tolerance_pct = models.FloatField(default=0.5)           # refinery reconciliation
    fx_discrepancy_pct = models.FloatField(default=5.0)                   # BoG FX flag
    max_report_attachments = models.PositiveSmallIntegerField(default=8)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get(cls):
        obj = cls.objects.first()
        return obj or cls.objects.create()
