from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import REGULATOR_ROLES, Role
from core.scoping import scope_batches
from miners.models import Miner

from .models import Assay, BatchStatus, CustodyEventType, GoldBatch, SecurityStatus
from .serializers import AssaySerializer, GoldBatchSerializer, PassportSerializer
from .services import (
    append_custody_event,
    build_qr,
    passport_hash,
    passport_url,
    verify_chain,
)


@extend_schema(tags=["production"])
class GoldBatchViewSet(viewsets.ModelViewSet):
    serializer_class = GoldBatchSerializer

    def get_throttles(self):
        if getattr(self, "action", None) == "verify":
            self.throttle_scope = "verify"
        return super().get_throttles()

    def get_queryset(self):
        qs = GoldBatch.objects.select_related("miner", "concession").prefetch_related("custody_events")
        return scope_batches(qs, self.request.user)

    # Gold batches originate at the source: only these roles may create them.
    # Every other role is oversight or downstream (receives batches via transfers).
    CREATOR_ROLES = {Role.MINER, Role.MINING_COMPANY, Role.GOLDBOD_OFFICER, Role.SUPER_ADMIN,
                     Role.TIER1_BUYER, Role.TIER2_BUYER, Role.AGGREGATOR, Role.BUYING_AGENT}

    def perform_create(self, serializer):
        user = self.request.user
        allowed = user.is_superuser or user.role in {r.value for r in self.CREATOR_ROLES}
        if not allowed:
            raise PermissionDenied(
                "Your role has oversight of the supply chain but does not create gold "
                "batches. Batches originate with a licensed miner at the source.")
        miner = serializer.validated_data.get("miner")
        if miner is None and user.role == Role.MINER:
            miner = Miner.objects.filter(user=user).first()
        if miner is None:
            raise ValidationError(
                {"miner": "Select the licensed miner this batch originates from."})
        batch = serializer.save(
            created_by=user, miner=miner, current_owner=miner.user,
        )

        batch.passport_hash = passport_hash(batch)
        batch.qr_image = build_qr(passport_url(batch), f"{batch.batch_code}.png")
        batch.save(update_fields=["passport_hash", "qr_image"])

        append_custody_event(
            batch, CustodyEventType.ORIGIN,
            actor=self.request.user, to_party=miner.license_number,
            metadata={"gross_weight_g": str(batch.gross_weight_g)},
        )


    @extend_schema(tags=["production"], responses=None)
    @action(detail=False, methods=["get"])
    def track(self, request):
        """Track any single gold: passport, custody chain, live location, security."""
        from .serializers import CustodyEventSerializer
        code = request.query_params.get("code", "")
        batch = get_object_or_404(
            GoldBatch.objects.select_related("miner", "concession", "current_owner")
            .prefetch_related("custody_events", "deliveries", "incidents"),
            batch_code=code)
        chain = verify_chain(batch)
        delivery = batch.deliveries.order_by("-created_at").first()
        location = None
        if delivery and delivery.courier_lat is not None:
            location = {"lat": delivery.courier_lat, "lng": delivery.courier_lng,
                        "status": delivery.get_status_display(), "seal": delivery.seal_number}
        incidents = [
            {"type": i.get_incident_type_display(), "type_code": i.incident_type,
             "status": i.get_status_display(), "note": i.note,
             "reported_by": i.reported_by.username if i.reported_by else None,
             "reported_at": i.created_at,
             "last_seen": ({"lat": i.last_seen_lat, "lng": i.last_seen_lng}
                           if i.last_seen_lat is not None else None),
             "resolved_at": i.resolved_at}
            for i in batch.incidents.order_by("-created_at")]
        open_incidents = [i for i in incidents
                          if i["status"] not in ("Recovered", "Closed")]
        compromised = (batch.security_status in ("stolen", "missing", "flagged")
                       or not chain["valid"])
        tamper = None
        if compromised:
            broken_evt = None
            if not chain["valid"] and chain.get("broken_at") is not None:
                evs = list(batch.custody_events.order_by("created_at"))
                idx = chain["broken_at"]
                if 0 <= idx < len(evs):
                    e = evs[idx]
                    broken_evt = {"event": e.get_event_type_display(),
                                  "actor": str(e.actor) if e.actor_id else None,
                                  "at": e.created_at}
            tamper = {
                "security_status": batch.get_security_status_display(),
                "chain_intact": chain["valid"],
                "chain_broken_at": chain.get("broken_at"),
                "broken_link": broken_evt,
                "recorded_seal": batch.seal_number or None,
                "message": ("The custody hash-chain is broken - records after the break "
                            "cannot be trusted." if not chain["valid"]
                            else "This gold has an active security flag."),
                "open_incident_count": len(open_incidents),
            }
        return Response({
            "batch_id": str(batch.id),
            "batch_code": batch.batch_code,
            "status": batch.get_status_display(),
            "security_status": batch.security_status,
            "miner_license": batch.miner.license_number,
            "current_owner": batch.current_owner.username if batch.current_owner else None,
            "gross_weight_g": str(batch.gross_weight_g),
            "fine_weight_g": str(batch.fine_weight_g) if batch.fine_weight_g else None,
            "fineness": batch.fineness,
            "passport_hash": batch.passport_hash,
            "chain_valid": chain["valid"],
            "chain_broken_at": chain.get("broken_at"),
            "chain_length": chain.get("length"),
            "seal_number": batch.seal_number or None,
            "compromised": compromised,
            "tamper": tamper,
            "last_location": location,
            "incidents": incidents,
            "open_incidents": open_incidents,
            "custody_chain": CustodyEventSerializer(
                batch.custody_events.order_by("created_at"), many=True).data,
        })

    # ---- Marketplace: role-restricted buy/sell of gold ----
    @extend_schema(tags=["production"])
    @action(detail=False, methods=["get"])
    def marketplace(self, request):
        """Listed batches THIS user may buy under the GoldBod flow
        (miner->tier1->tier2->aggregator->GoldBod->export)."""
        from core.supply_chain import resolve_stage
        user = request.user
        listings = (GoldBatch.objects.filter(listed_for_sale=True)
                    .select_related("miner", "current_owner").order_by("-updated_at"))
        out = []
        for b in listings:
            owner = b.current_owner
            if not owner or owner.id == user.id:
                continue
            _stage, eligible = resolve_stage(owner.role, user.role)
            if not (eligible or user.is_superuser):
                continue
            out.append({
                "id": str(b.id), "batch_code": b.batch_code,
                "gross_weight_g": str(b.gross_weight_g),
                "fine_weight_g": str(b.fine_weight_g) if b.fine_weight_g else None,
                "fineness": b.fineness, "asking_price_ghs": str(b.asking_price_ghs or 0),
                "seller": owner.username, "seller_role": owner.get_role_display(),
                "security_status": b.security_status,
            })
        return Response({"listings": out})

    @extend_schema(tags=["production"])
    @action(detail=True, methods=["post"])
    def list_for_sale(self, request, pk=None):
        batch = self.get_object()
        if batch.current_owner_id != request.user.id and not request.user.is_superuser:
            return Response({"detail": "Only the current owner can list this gold."}, status=403)
        batch.listed_for_sale = True
        price = request.data.get("asking_price_ghs")
        if price not in (None, ""):
            batch.asking_price_ghs = price
        if request.data.get("seal_number"):
            batch.seal_number = request.data["seal_number"]
        batch.save(update_fields=["listed_for_sale", "asking_price_ghs", "seal_number"])
        return Response(self.get_serializer(batch).data)

    @extend_schema(tags=["production"])
    @action(detail=True, methods=["post"])
    def unlist(self, request, pk=None):
        batch = self.get_object()
        if batch.current_owner_id != request.user.id and not request.user.is_superuser:
            return Response({"detail": "Only the current owner can unlist this gold."}, status=403)
        batch.listed_for_sale = False
        batch.save(update_fields=["listed_for_sale"])
        return Response(self.get_serializer(batch).data)

    @extend_schema(tags=["production"])
    @action(detail=True, methods=["post"])
    def buy(self, request, pk=None):
        """Eligible buyer purchases a listed batch: ownership moves, receipt issued."""
        from decimal import Decimal

        from core.supply_chain import resolve_stage
        from trading.models import OwnershipTransfer, TransferStatus

        batch = self.get_object()
        buyer = request.user
        seller = batch.current_owner
        if not batch.listed_for_sale or seller is None:
            return Response({"detail": "This gold is not on the market."}, status=400)
        if seller.id == buyer.id:
            return Response({"detail": "You already own this gold."}, status=400)
        stage, eligible = resolve_stage(seller.role, buyer.role)
        if not (eligible or buyer.is_superuser):
            return Response({"detail": "Your role is not permitted to buy from this seller "
                             "under the GoldBod supply-chain flow."}, status=403)
        price = batch.asking_price_ghs or Decimal("0")
        existing = OwnershipTransfer.objects.filter(
            batch=batch, buyer=buyer, status=TransferStatus.PENDING).first()
        if existing:
            return Response({"detail": "You already have a pending request on this gold, "
                             "awaiting the seller's approval.", "batch_code": batch.batch_code})
        OwnershipTransfer.objects.create(
            batch=batch, seller=seller, buyer=buyer, price=price, currency="GHS",
            stage=stage, irregular=not eligible, status=TransferStatus.PENDING)
        return Response({"detail": "Purchase request submitted. The seller (or a GoldBod officer) "
                         "must approve it before ownership moves and a receipt is issued.",
                         "batch_code": batch.batch_code})

    @extend_schema(tags=["production"])
    @action(detail=True, methods=["post"])
    def clear_security(self, request, pk=None):
        """CEO / GoldBod officer / security clears a stolen or tampered flag once the
        gold is accounted for. Open incidents are resolved and the flag lifted."""
        from django.utils import timezone

        from security.models import IncidentStatus
        CLEAR_ROLES = {"ceo", "goldbod_officer", "super_admin", "security_agency"}
        if not (request.user.is_superuser or request.user.role in CLEAR_ROLES):
            return Response({"detail": "Only GoldBod oversight can clear a security flag."},
                            status=403)
        batch = self.get_object()
        note = request.data.get("note", "")
        resolved = batch.incidents.exclude(
            status__in=[IncidentStatus.RECOVERED, IncidentStatus.CLOSED]).update(
            status=IncidentStatus.RECOVERED, resolved_at=timezone.now())
        batch.security_status = SecurityStatus.RECOVERED
        batch.save(update_fields=["security_status"])
        _ = note
        return Response({"detail": f"Security flag cleared. {resolved} incident(s) resolved.",
                         "security_status": batch.security_status})

    @extend_schema(tags=["production"])
    @action(detail=True, methods=["post"])
    def scan_seal(self, request, pk=None):
        """Tamper-evident check: reconcile a scanned seal against the recorded one."""
        from security.models import IncidentStatus, IncidentType, SecurityIncident
        batch = self.get_object()
        scanned = (request.data.get("seal_number") or "").strip()
        if not scanned:
            return Response({"detail": "Provide the scanned seal number."}, status=400)
        expected = batch.seal_number or ""
        if not expected:
            batch.seal_number = scanned
            batch.save(update_fields=["seal_number"])
            return Response({"match": True, "note": "Seal registered on this batch."})
        if scanned == expected:
            return Response({"match": True, "note": "Seal intact - matches custody record."})
        SecurityIncident.objects.create(
            batch=batch, incident_type=IncidentType.TAMPER, status=IncidentStatus.OPEN,
            note=f"Seal mismatch on scan: expected {expected}, scanned {scanned}.",
            reported_by=request.user)
        batch.security_status = SecurityStatus.FLAGGED
        batch.save(update_fields=["security_status"])
        return Response({"match": False, "tamper": True,
                         "note": "SEAL MISMATCH - a tamper incident has been raised and the gold flagged.",
                         "expected": expected, "scanned": scanned})

    @extend_schema(tags=["production"], responses=PassportSerializer)
    @action(detail=False, methods=["get"])
    def verify(self, request):
        """Resolve a scanned QR / batch code to its passport and verified chain."""
        code = request.query_params.get("code", "")
        batch = get_object_or_404(
            GoldBatch.objects.prefetch_related("custody_events"), batch_code=code,
        )
        chain = verify_chain(batch)
        payload = {
            "batch_code": batch.batch_code,
            "status": batch.get_status_display(),
            "miner_license": batch.miner.license_number,
            "gross_weight_g": batch.gross_weight_g,
            "fine_weight_g": batch.fine_weight_g,
            "fineness": batch.fineness,
            "passport_hash": batch.passport_hash,
            "chain_valid": chain["valid"],
            "anchored": batch.custody_events.exclude(anchored_tx="").exists(),
            "custody_chain": batch.custody_events.order_by("created_at"),
        }
        return Response(PassportSerializer(payload).data, status=status.HTTP_200_OK)


@extend_schema(tags=["production"])
class AssayViewSet(viewsets.ModelViewSet):
    serializer_class = AssaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Assay.objects.select_related("batch", "assayer").all()

    def perform_create(self, serializer):
        assay = serializer.save(assayer=self.request.user)
        b = assay.batch
        b.fine_weight_g = assay.fine_weight_g
        b.fineness = assay.fineness
        b.gross_weight_g = assay.gross_weight_g
        if b.status == BatchStatus.CREATED:
            b.status = BatchStatus.ASSAYED
        b.save(update_fields=["fine_weight_g", "fineness", "gross_weight_g", "status"])
