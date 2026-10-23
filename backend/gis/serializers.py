from rest_framework import serializers

from .models import Hotspot


class HotspotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hotspot
        fields = (
            "id", "title", "latitude", "longitude", "severity", "status",
            "region", "source", "created_at",
        )
        read_only_fields = ("created_at",)

    def validate(self, attrs):
        from .ghana import nearest_region, validate_point
        validate_point(attrs.get("latitude"), attrs.get("longitude"))
        if not attrs.get("region") and attrs.get("latitude") is not None:
            attrs["region"] = nearest_region(attrs["latitude"], attrs["longitude"]) or ""
        return attrs


class DetectedMiningSiteSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    concession_ref = serializers.CharField(source="matched_concession.code", read_only=True, default=None)

    class Meta:
        from .models import DetectedMiningSite
        model = DetectedMiningSite
        fields = ("id", "latitude", "longitude", "region", "source", "confidence", "area_ha",
                  "detected_at", "operator_name", "status", "status_display",
                  "matched_concession", "concession_ref", "note")
        read_only_fields = ("id", "detected_at", "status", "matched_concession")

    def validate(self, attrs):
        from .ghana import nearest_region, normalise_region, validate_point
        validate_point(attrs.get("latitude"), attrs.get("longitude"))
        attrs["region"] = (normalise_region(attrs.get("region"))
                           or nearest_region(attrs["latitude"], attrs["longitude"]) or "")
        return attrs
