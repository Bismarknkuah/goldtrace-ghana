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


class DetectionStatus(models.TextChoices):
    UNVERIFIED = "unverified", "Unverified"
    SUSPECTED_ILLEGAL = "suspected_illegal", "Suspected illegal"
    CONFIRMED_ILLEGAL = "confirmed_illegal", "Confirmed illegal"
    LICENSED = "licensed", "Within licensed concession"
    DISMISSED = "dismissed", "Dismissed"


class DetectedMiningSite(TimeStampedModel):
    """A mining site detected from satellite imagery (or a field report) and
    reconciled against licensed concessions. Sites outside any concession are
    flagged as suspected illegal mining and surfaced on the national map."""
    latitude = models.FloatField()
    longitude = models.FloatField()
    region = models.CharField(max_length=80, blank=True)
    source = models.CharField(max_length=40, default="satellite")  # satellite / field_report
    confidence = models.FloatField(default=0.0)  # 0-1 from the detection model
    area_ha = models.FloatField(null=True, blank=True)
    detected_at = models.DateTimeField(auto_now_add=True, db_index=True)
    operator_name = models.CharField(max_length=160, blank=True)  # unregistered operator if known
    status = models.CharField(max_length=20, choices=DetectionStatus.choices,
                              default=DetectionStatus.UNVERIFIED, db_index=True)
    matched_concession = models.ForeignKey(
        "miners.Concession", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="detections")
    note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-detected_at"]

    def __str__(self):
        return f"Detection {self.latitude:.4f},{self.longitude:.4f} ({self.status})"
