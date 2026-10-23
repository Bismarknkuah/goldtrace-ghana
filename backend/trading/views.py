from django.db import models

from core.supply_chain import resolve_stage
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import REGULATOR_ROLES
from production.models import BatchStatus, CustodyEventType, GoldBatch
from production.services import append_custody_event

from rest_framework.permissions import IsAuthenticated

from accounts.models import REGULATOR_ROLES
from .models import OwnershipTransfer, PaymentReceipt, TransferStatus
from .serializers import OwnershipTransferSerializer, PaymentReceiptSerializer


@extend_schema(tags=["trading"])
class OwnershipTransferViewSet(viewsets.ModelViewSet):
    serializer_class = OwnershipTransferSerializer

    def get_queryset(self):
        user = self.request.user
        qs = OwnershipTransfer.objects.select_related("batch", "seller", "buyer")
        if user.is_superuser or user.role in {r.value for r in REGULATOR_ROLES}:
            return qs
        return qs.filter(models.Q(seller=user) | models.Q(buyer=user))

    def perform_create(self, serializer):
        batch = serializer.validated_data["batch"]
        if batch.current_owner_id not in (self.request.user.id, None):
            raise PermissionDenied("Only the current owner can initiate a transfer.")
        buyer = serializer.validated_data["buyer"]
        stage, regular = resolve_stage(self.request.user.role, buyer.role)
        serializer.save(seller=self.request.user, stage=stage, irregular=not regular)

    @extend_schema(tags=["trading"])
    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Buyer (or a regulator) confirms; ownership moves and a TRANSFER link is written."""
        transfer = self.get_object()
        if transfer.status != TransferStatus.PENDING:
            raise ValidationError("Transfer is not pending.")

        batch = transfer.batch
        append_custody_event(
            batch, CustodyEventType.TRANSFER, actor=request.user,
            from_party=str(transfer.seller), to_party=str(transfer.buyer),
            metadata={"price": str(transfer.price), "currency": transfer.currency},
        )
        batch.current_owner = transfer.buyer
        batch.status = BatchStatus.IN_TRANSIT
        batch.listed_for_sale = False
        batch.save(update_fields=["current_owner", "status", "listed_for_sale"])

        transfer.status = TransferStatus.COMPLETED
        transfer.completed_at = timezone.now()
        transfer.save(update_fields=["status", "completed_at"])

        # Issue the buyer's payment receipt to the seller.
        PaymentReceipt.objects.get_or_create(
            transfer=transfer,
            defaults={"payer": transfer.buyer, "payee": transfer.seller,
                      "amount": transfer.price or 0, "currency": transfer.currency})
        return Response(self.get_serializer(transfer).data, status=status.HTTP_200_OK)

    @extend_schema(tags=["trading"])
    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        """Seller (or a GoldBod officer) declines a pending purchase request."""
        transfer = self.get_object()
        if transfer.status != TransferStatus.PENDING:
            raise ValidationError("Transfer is not pending.")
        is_seller = transfer.seller_id == request.user.id
        is_oversight = request.user.is_superuser or request.user.role in {
            r.value for r in REGULATOR_ROLES}
        if not (is_seller or is_oversight):
            return Response({"detail": "Only the seller or a GoldBod officer can decline."},
                            status=403)
        transfer.status = TransferStatus.CANCELLED
        transfer.save(update_fields=["status"])
        return Response(self.get_serializer(transfer).data)


@extend_schema(tags=["trading"])
class PaymentReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentReceiptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = PaymentReceipt.objects.select_related("payer", "payee", "transfer__batch")
        if user.is_superuser or user.role in {r.value for r in REGULATOR_ROLES}:
            return qs
        return qs.filter(payee=user) | qs.filter(payer=user)
