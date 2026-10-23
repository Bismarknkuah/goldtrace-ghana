import secrets

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


def make_token():
    return secrets.token_urlsafe(18)


class ReportLink(TimeStampedModel):
    """A public share link the CEO generates for citizens to report mining issues."""
    token = models.CharField(max_length=40, unique=True, default=make_token, editable=False)
    title = models.CharField(max_length=160, default="Report illegal mining")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="report_links")
    active = models.BooleanField(default=True)
    submissions = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.title} ({self.token})"


class ReportCategory(models.TextChoices):
    ILLEGAL_MINING = "illegal_mining", "Illegal mining"
    ENVIRONMENTAL = "environmental", "Environmental damage"
    SMUGGLING = "smuggling", "Smuggling / suspicious movement"
    SAFETY = "safety", "Safety / community harm"
    OTHER = "other", "Other"


class ReportStatus(models.TextChoices):
    NEW = "new", "New"
    UNDER_REVIEW = "under_review", "Under review"
    RESOLVED = "resolved", "Resolved"
    DISMISSED = "dismissed", "Dismissed"


class PublicReport(TimeStampedModel):
    """A citizen report submitted through a share link. Location feeds the
    geospatial detection pipeline; attachments are stored as data URLs."""
    link = models.ForeignKey(ReportLink, on_delete=models.PROTECT, related_name="reports")
    category = models.CharField(max_length=20, choices=ReportCategory.choices,
                                default=ReportCategory.ILLEGAL_MINING, db_index=True)
    description = models.TextField()
    reporter_name = models.CharField(max_length=120, blank=True)
    reporter_phone = models.CharField(max_length=40, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    region = models.CharField(max_length=80, blank=True)
    location_text = models.CharField(max_length=200, blank=True)
    attachments = models.JSONField(default=list, blank=True)  # [{name, type, data}]
    status = models.CharField(max_length=14, choices=ReportStatus.choices,
                              default=ReportStatus.NEW, db_index=True)
    assigned_to = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True,
                                         related_name="assigned_reports")
    detection = models.ForeignKey("gis.DetectedMiningSite", null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="reports")
    officer_note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_category_display()} @ {self.region or self.location_text}"
