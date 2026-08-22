"""Geospatial monitoring: illegal-mining hotspots (concessions live in miners)."""
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class Severity(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class HotspotStatus(models.TextChoices):
    DETECTED = "detected", "Detected"
    INVESTIGATING = "investigating", "Investigating"
    RESOLVED = "resolved", "Resolved"


class Hotspot(TimeStampedModel):
    """A reported or AI-detected illegal-mining location."""

    title = models.CharField(max_length=160)
    latitude = models.FloatField()
    longitude = models.FloatField()
    # GeoJSON Point mirror for 2dsphere indexing in Atlas.
    location = models.JSONField(default=dict, blank=True)
    severity = models.CharField(max_length=8, choices=Severity.choices, default=Severity.MEDIUM, db_index=True)
    status = models.CharField(max_length=14, choices=HotspotStatus.choices, default=HotspotStatus.DETECTED, db_index=True)
    region = models.CharField(max_length=80, blank=True)
    source = models.CharField(max_length=80, blank=True, help_text="satellite | report | patrol | ai")
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="reported_hotspots",
    )

    def save(self, *args, **kwargs):
        self.location = {"type": "Point", "coordinates": [self.longitude, self.latitude]}
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.severity})"
