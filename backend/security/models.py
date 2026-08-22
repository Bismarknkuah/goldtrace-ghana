"""Anti-theft / loss protection: incidents raised against a gold batch."""
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from production.models import GoldBatch


class IncidentType(models.TextChoices):
    MISSING = "missing", "Reported missing"
    STOLEN = "stolen", "Reported stolen"
    TAMPER = "tamper", "Tamper / seal broken"
    UNACCOUNTED = "unaccounted", "Unaccounted (custody gap)"


class IncidentStatus(models.TextChoices):
    OPEN = "open", "Open"
    INVESTIGATING = "investigating", "Investigating"
    RECOVERED = "recovered", "Recovered"
    CLOSED = "closed", "Closed"


class SecurityIncident(TimeStampedModel):
    batch = models.ForeignKey(GoldBatch, on_delete=models.PROTECT, related_name="incidents")
    incident_type = models.CharField(max_length=12, choices=IncidentType.choices, db_index=True)
    status = models.CharField(max_length=14, choices=IncidentStatus.choices,
                              default=IncidentStatus.OPEN, db_index=True)
    note = models.CharField(max_length=255, blank=True)
    last_seen_lat = models.FloatField(null=True, blank=True)
    last_seen_lng = models.FloatField(null=True, blank=True)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="reported_incidents")
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.batch.batch_code}: {self.incident_type} [{self.status}]"
