from rest_framework import serializers

from .models import ReferenceRate


class ReferenceRateSerializer(serializers.ModelSerializer):
    set_by_name = serializers.CharField(source="set_by.username", read_only=True, default=None)

    class Meta:
        model = ReferenceRate
        fields = ("id", "rate_ghs_per_g", "effective_date", "source", "set_by",
                  "set_by_name", "created_at")
        read_only_fields = ("set_by", "created_at")
