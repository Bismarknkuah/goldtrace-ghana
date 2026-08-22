from rest_framework import serializers

from .models import CustodyEvent, GoldBatch


class CustodyEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)

    class Meta:
        model = CustodyEvent
        fields = (
            "id", "batch", "event_type", "event_type_display", "from_party",
            "to_party", "actor", "location", "metadata", "event_hash",
            "previous_hash", "anchored_tx", "created_at",
        )
        read_only_fields = ("event_hash", "previous_hash", "anchored_tx", "created_at")


class GoldBatchSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    custody_events = CustodyEventSerializer(many=True, read_only=True)
    qr_image = serializers.ImageField(read_only=True)

    class Meta:
        model = GoldBatch
        fields = (
            "id", "batch_code", "miner", "concession", "gross_weight_g",
            "fine_weight_g", "fineness", "status", "status_display", "security_status", "listed_for_sale", "asking_price_ghs", "seal_number", "origin_latitude", "origin_longitude", "field_notes",
            "source_point", "qr_image", "passport_hash", "anchored_tx",
            "created_by", "current_owner", "custody_events", "created_at", "updated_at",
        )
        read_only_fields = (
            "batch_code", "qr_image", "passport_hash", "anchored_tx",
            "status", "security_status", "listed_for_sale", "asking_price_ghs", "seal_number", "origin_latitude", "origin_longitude", "field_notes", "created_by", "current_owner", "created_at", "updated_at",
        )


class PassportSerializer(serializers.Serializer):
    """Public-facing verification payload returned by the QR-scan endpoint."""

    batch_code = serializers.CharField()
    status = serializers.CharField()
    miner_license = serializers.CharField()
    gross_weight_g = serializers.DecimalField(max_digits=12, decimal_places=3)
    fine_weight_g = serializers.DecimalField(max_digits=12, decimal_places=3, allow_null=True)
    fineness = serializers.IntegerField(allow_null=True)
    passport_hash = serializers.CharField()
    chain_valid = serializers.BooleanField()
    anchored = serializers.BooleanField()
    custody_chain = CustodyEventSerializer(many=True)


class AssaySerializer(serializers.ModelSerializer):
    batch_code = serializers.CharField(source="batch.batch_code", read_only=True)
    assayer_name = serializers.CharField(source="assayer.username", read_only=True, default=None)
    method_display = serializers.CharField(source="get_method_display", read_only=True)

    class Meta:
        from .models import Assay
        model = Assay
        fields = ("id", "batch", "batch_code", "assayer", "assayer_name", "method",
                  "method_display", "gross_weight_g", "fine_weight_g", "fineness",
                  "certificate_no", "remarks", "created_at")
        read_only_fields = ("assayer", "certificate_no", "created_at")
