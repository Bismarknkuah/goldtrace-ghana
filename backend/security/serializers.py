from rest_framework import serializers

from .models import SecurityIncident


class SecurityIncidentSerializer(serializers.ModelSerializer):
    batch_code = serializers.CharField(source="batch.batch_code", read_only=True)
    type_display = serializers.CharField(source="get_incident_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = SecurityIncident
        fields = ("id", "batch", "batch_code", "incident_type", "type_display",
                  "status", "status_display", "note", "last_seen_lat", "last_seen_lng",
                  "reported_by", "resolved_at", "created_at")
        read_only_fields = ("status", "reported_by", "resolved_at", "created_at")
