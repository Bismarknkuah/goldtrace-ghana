from django.db import models

from core.supply_chain import explain, licence_status, resolve_stage
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes

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
        user = self.request.user
        stage, regular = resolve_stage(user.role, buyer.role)
        oversight = user.is_superuser or user.role in REGULATOR_ROLES
        if not regular and not oversight:
            raise PermissionDenied(explain(user.role, buyer.role))
        if not oversight:
            for who, party in (("Your", user), ("The buyer's", buyer)):
                lic = licence_status(party)
                if lic["required"] and not lic["ok"]:
                    raise PermissionDenied(f"{who} licence is not valid: {lic['detail']}")
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


class TradingRulesView(APIView):
    """GoldBod trading rulebook: who may sell to whom and which licence each tier needs."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["trading"], responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from core.supply_chain import ROLE_LABEL, FLOW, may_buy_from, rulebook
        data = rulebook()
        role = request.user.role
        data["me"] = {
            "role": role, "label": ROLE_LABEL.get(role, role),
            "sells_to": [ROLE_LABEL.get(b, b) for b in FLOW.get(role, {})],
            "buys_from": [ROLE_LABEL.get(s, s) for s in may_buy_from(role)],
            "licence": licence_status(request.user),
        }
        return Response(data)


class MyComplianceView(APIView):
    """A personal compliance checklist: what this user must fix to trade legally."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["trading"], responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from datetime import date

        from core.supply_chain import MINING_LICENCE_ROLES, TRADING_ROLES
        from gis.sourcing import lot_origin
        from trading.models import OwnershipTransfer

        u = request.user
        items = []

        def item(key, label, ok, detail, action=None, link=None, weight=1):
            items.append({"key": key, "label": label, "ok": bool(ok), "detail": detail,
                          "action": None if ok else action, "link": None if ok else link,
                          "weight": weight})

        item("ghana_card", "Ghana Card on file", u.ghana_card_number,
             "Identity is bound to a Ghana Card." if u.ghana_card_number else "No Ghana Card number recorded.",
             "Add your Ghana Card number in your profile.", "profile", 2)
        item("phone", "Contact phone", u.phone, u.phone or "No phone number recorded.",
             "Add a phone number so GoldBod can reach you.", "profile")
        item("location", "Business location", u.region,
             f"{u.district + ', ' if u.district else ''}{u.region}" if u.region else "No region recorded.",
             "Set your region and location in your profile.", "profile")

        trading = u.role in TRADING_ROLES
        if trading:
            lic = licence_status(u)
            if lic["required"]:
                days = (lic["expires_at"] - date.today()).days if lic["expires_at"] else None
                detail = lic["detail"] + (f" Expires in {days} days." if days is not None and days >= 0 else "")
                item("licence", "Valid licence for your tier", lic["ok"], detail,
                     "Apply for or renew your licence with GoldBod.",
                     "concessions" if u.role in MINING_LICENCE_ROLES else "licensing", 3)
                if lic["ok"] and days is not None and days <= 60:
                    items.append({"key": "licence_renewal", "label": "Licence renewal due",
                                  "ok": False, "detail": f"Licence expires in {days} days.",
                                  "action": "Start your renewal now to avoid a trading stop.",
                                  "link": "licensing", "weight": 1})
            if u.role in MINING_LICENCE_ROLES:
                from miners.models import Concession
                has_c = Concession.objects.filter(miner__user=u, is_active=True).exists() or (
                    u.company_id and Concession.objects.filter(miner__company_id=u.company_id,
                                                               is_active=True).exists())
                item("concession", "Registered concession", has_c,
                     "Active concession boundary on the map." if has_c else "No active concession registered.",
                     "Register your concession boundary so your gold's origin can be verified.",
                     "concessions", 2)

            held = list(GoldBatch.objects.filter(current_owner=u)
                        .exclude(status__in=["exported", "refined"]))
            no_assay = [b.batch_code for b in held if not b.fineness]
            no_gps = [b.batch_code for b in held if lot_origin(b) is None]
            flagged = [b.batch_code for b in held if b.security_status in ("flagged", "stolen", "missing")]
            item("assay", "Lots assayed", not no_assay,
                 "All lots you hold are assayed." if not no_assay else
                 f"{len(no_assay)} lot(s) not assayed: {', '.join(no_assay[:5])}",
                 "Book an assay with GoldBod before selling.", "batches", 2)
            item("origin", "Lots have GPS origin", not no_gps,
                 "Every lot carries a verified mine-site location." if not no_gps else
                 f"{len(no_gps)} lot(s) have no GPS origin: {', '.join(no_gps[:5])}",
                 "Record where the gold was mined; lots without origin are held for review.", "batches", 2)
            item("flags", "No security flags", not flagged,
                 "No lot you hold is flagged." if not flagged else
                 f"Flagged lots: {', '.join(flagged[:5])}",
                 "Contact GoldBod security to resolve the flag.", "security", 3)
            irregular = OwnershipTransfer.objects.filter(seller=u, irregular=True).count() + \
                OwnershipTransfer.objects.filter(buyer=u, irregular=True).count()
            item("irregular", "Trades follow GoldBod rules", irregular == 0,
                 "All your trades followed the permitted order." if irregular == 0 else
                 f"{irregular} trade(s) were outside the permitted order or held for review.",
                 "Review the trading rules; only sell to the tiers you are permitted to.", "rules", 2)
            pending = OwnershipTransfer.objects.filter(seller=u, status="pending").count()
            item("pending", "Purchase requests answered", pending == 0,
                 "No buyers waiting on you." if pending == 0 else f"{pending} buyer request(s) awaiting your approval.",
                 "Approve or decline pending requests.", "transfers")

        total = sum(i["weight"] for i in items) or 1
        score = round(100 * sum(i["weight"] for i in items if i["ok"]) / total)
        level = "good" if score >= 85 else "fair" if score >= 60 else "poor"
        return Response({"score": score, "level": level, "trading_role": trading,
                         "items": items,
                         "actions": [i for i in items if not i["ok"]]})
