from rest_framework import serializers

from .models import License


class LicenseSerializer(serializers.ModelSerializer):
    holder_name = serializers.CharField(source="holder.username", read_only=True)
    type_display = serializers.CharField(source="get_license_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = License
        fields = ("id", "holder", "holder_name", "license_type", "type_display",
                  "license_number", "status", "status_display", "is_valid",
                  "region", "operating_areas", "working_capital_ghs",
                  "trade_capital_ghs", "expires_at", "renewal_requested", "issued_by", "created_at")
        read_only_fields = ("license_number", "status", "issued_by", "created_at")


class RegistryLookupSerializer(serializers.ModelSerializer):
    """Public view — confirms a licence without exposing financials."""

    holder_name = serializers.CharField(source="holder.username", read_only=True)
    type_display = serializers.CharField(source="get_license_type_display", read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = License
        fields = ("license_number", "type_display", "holder_name", "region",
                  "status", "is_valid", "expires_at")
