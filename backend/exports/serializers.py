from rest_framework import serializers

from .models import ExportCertificate


class ExportCertificateSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ExportCertificate
        fields = (
            "id", "batch", "exporter", "certificate_number", "destination_country",
            "fine_weight_g", "fineness", "status", "status_display",
            "certificate_hash", "anchored_tx", "qr_image",
            "issued_by", "issued_at", "created_at",
        )
        read_only_fields = (
            "certificate_number", "status", "certificate_hash", "anchored_tx",
            "qr_image", "issued_by", "issued_at", "created_at",
        )


class CertificateVerifySerializer(serializers.Serializer):
    certificate_number = serializers.CharField()
    status = serializers.CharField()
    batch_code = serializers.CharField()
    destination_country = serializers.CharField()
    fine_weight_g = serializers.DecimalField(max_digits=12, decimal_places=3)
    certificate_hash = serializers.CharField()
    chain_valid = serializers.BooleanField()
    valid = serializers.BooleanField()
