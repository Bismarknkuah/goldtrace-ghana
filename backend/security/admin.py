from django.contrib import admin

from .models import SecurityIncident


@admin.register(SecurityIncident)
class SecurityIncidentAdmin(admin.ModelAdmin):
    list_display = ("batch", "incident_type", "status", "reported_by", "created_at")
    list_filter = ("incident_type", "status")
