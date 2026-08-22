from rest_framework import serializers

from .models import DueDiligence, KycScreening


class KycScreeningSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = KycScreening
        fields = ("id", "subject_name", "subject_user", "country", "purpose",
                  "sanctions_hit", "pep", "risk_rating", "status", "status_display",
                  "note", "screened_by", "created_at")
        read_only_fields = ("sanctions_hit", "pep", "risk_rating", "status",
                            "screened_by", "created_at")


class DueDiligenceSerializer(serializers.ModelSerializer):
    batch_code = serializers.CharField(source="batch.batch_code", read_only=True)
    responsible = serializers.BooleanField(read_only=True)

    class Meta:
        model = DueDiligence
        fields = ("id", "batch", "batch_code", "origin_verified", "conflict_free",
                  "oecd_conformant", "oecd_step", "statement", "responsible",
                  "attested_by", "created_at")
        read_only_fields = ("attested_by", "created_at", "responsible")
