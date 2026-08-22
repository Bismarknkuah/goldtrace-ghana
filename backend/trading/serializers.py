from rest_framework import serializers

from .models import OwnershipTransfer


class OwnershipTransferSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    seller_name = serializers.CharField(source="seller.username", read_only=True)
    buyer_name = serializers.CharField(source="buyer.username", read_only=True)
    batch_code = serializers.CharField(source="batch.batch_code", read_only=True)

    class Meta:
        model = OwnershipTransfer
        fields = (
            "id", "batch", "batch_code", "seller", "seller_name", "buyer", "buyer_name",
            "price", "currency", "status", "status_display", "stage", "irregular",
            "completed_at", "created_at",
        )
        read_only_fields = ("seller", "status", "completed_at", "created_at")


class PaymentReceiptSerializer(serializers.ModelSerializer):
    payer_name = serializers.CharField(source="payer.username", read_only=True)
    payee_name = serializers.CharField(source="payee.username", read_only=True)
    batch_code = serializers.CharField(source="transfer.batch.batch_code", read_only=True)

    class Meta:
        from .models import PaymentReceipt
        model = PaymentReceipt
        fields = (
            "id", "reference", "transfer", "batch_code", "payer", "payer_name",
            "payee", "payee_name", "amount", "currency", "created_at",
        )
        read_only_fields = fields
