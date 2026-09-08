from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Concession, Miner, MinerDocument


class ConcessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concession
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")


class MinerDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MinerDocument
        fields = ("id", "miner", "doc_type", "file", "note", "created_at")
        read_only_fields = ("created_at",)


class MinerSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    concessions = ConcessionSerializer(many=True, read_only=True)

    class Meta:
        model = Miner
        fields = (
            "id", "user", "user_detail", "license_number", "license_status",
            "license_expiry", "region", "district", "verified_by",
            "concessions", "created_at", "updated_at",
        )
        read_only_fields = ("license_status", "verified_by", "created_at", "updated_at")


class MiningCompanySerializer(serializers.ModelSerializer):
    miner_count = serializers.IntegerField(source="miners.count", read_only=True)

    class Meta:
        from .models import MiningCompany
        model = MiningCompany
        fields = ("id", "name", "registration_no", "region", "contact_email",
                  "contact_phone", "is_active", "miner_count", "created_at")
        read_only_fields = ("created_at",)
