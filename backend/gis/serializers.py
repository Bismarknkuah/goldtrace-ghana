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
