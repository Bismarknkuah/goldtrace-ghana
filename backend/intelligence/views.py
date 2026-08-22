from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ENFORCEMENT_ROLES, REGULATOR_ROLES, Role
from gis.models import Hotspot
from gis.services import haversine_km, point_in_polygon
from miners.models import LicenseStatus
from production.models import GoldBatch
from production.services import verify_chain

from .services import detect_anomalies, evaluate, evaluate_participant

HOTSPOT_RADIUS_KM = 5.0
_ALLOWED = {r.value for r in REGULATOR_ROLES} | {r.value for r in ENFORCEMENT_ROLES}


def _signals_for(batch, hotspots, passport_counts):
    src = (batch.source_point or {}).get("coordinates")
    origin_in = None
    if src and batch.concession and batch.concession.boundary:
        origin_in = point_in_polygon(src[0], src[1], batch.concession.boundary.get("coordinates"))

    near_hotspot = False
    if src:
        near_hotspot = any(
            haversine_km(src[1], src[0], h.latitude, h.longitude) <= HOTSPOT_RADIUS_KM
            for h in hotspots)

    weight_ok = True
    if batch.fine_weight_g is not None and batch.fine_weight_g > batch.gross_weight_g:
        weight_ok = False
    if batch.fineness is not None and not (1 <= batch.fineness <= 1000):
        weight_ok = False

    return {
        "chain_valid": verify_chain(batch)["valid"],
        "origin_in_concession": origin_in,
        "miner_active": batch.miner.license_status == LicenseStatus.ACTIVE,
        "weight_ok": weight_ok,
        "near_hotspot": near_hotspot,
        "duplicate_passport": passport_counts.get(batch.passport_hash, 0) > 1,
        "anchored": batch.custody_events.exclude(anchored_tx="").exists(),
    }


@extend_schema(tags=["intelligence"], responses=OpenApiTypes.OBJECT)
class RiskOverview(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or user.role in _ALLOWED):
            return Response({"detail": "Enforcement or regulator access required."}, status=403)

        batches = list(GoldBatch.objects.select_related("miner", "concession")
                       .prefetch_related("custody_events")[:300])
        hotspots = list(Hotspot.objects.all())
        counts = {}
        for b in batches:
            counts[b.passport_hash] = counts.get(b.passport_hash, 0) + 1

        assessed = []
        summary = {"clear": 0, "watch": 0, "elevated": 0, "critical": 0}
        for b in batches:
            a = evaluate(_signals_for(b, hotspots, counts))
            summary[a["level"]] += 1
            assessed.append({
                "batch_id": str(b.id), "batch_code": b.batch_code,
                "miner": b.miner.license_number, "region": b.miner.region,
                "score": a["score"], "level": a["level"], "flags": a["flags"],
            })
        assessed.sort(key=lambda x: x["score"], reverse=True)
        summary["total"] = len(batches)
        return Response({"summary": summary, "batches": assessed})


REQUIRE_LICENSE = {Role.TIER1_BUYER.value, Role.TIER2_BUYER.value, Role.AGGREGATOR.value,
                   Role.EXPORTER.value, Role.REFINERY_OPERATOR.value}
PARTICIPANT_ROLES = REQUIRE_LICENSE | {Role.MINER.value, Role.BUYING_AGENT.value,
                                       Role.INTERNATIONAL_BUYER.value, Role.MINING_COMPANY.value}


@extend_schema(tags=["intelligence"], responses=OpenApiTypes.OBJECT)
class ParticipantRiskView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or user.role in _ALLOWED):
            return Response({"detail": "Enforcement or regulator access required."}, status=403)

        from django.contrib.auth import get_user_model
        from django.db.models import Q

        from compliance.models import KycScreening
        from licensing.models import License, LicenseStatus
        from trading.models import OwnershipTransfer

        User = get_user_model()
        people = User.objects.filter(role__in=PARTICIPANT_ROLES)

        assessed = []
        summary = {"clear": 0, "watch": 0, "elevated": 0, "critical": 0}
        for p in people:
            kyc = KycScreening.objects.filter(subject_user=p).order_by("-created_at").first()
            unlicensed = (p.role in REQUIRE_LICENSE and not License.objects.filter(
                holder=p, status=LicenseStatus.ACTIVE).exists())
            irregular = OwnershipTransfer.objects.filter(
                Q(seller=p) | Q(buyer=p), irregular=True).count()
            a = evaluate_participant({
                "kyc": kyc.status if kyc else None,
                "unlicensed": unlicensed,
                "irregular_transfers": irregular,
            })
            summary[a["level"]] += 1
            assessed.append({
                "username": p.username, "role": p.role, "role_display": p.get_role_display(),
                "level": a["level"], "score": a["score"], "flags": a["flags"],
            })
        assessed.sort(key=lambda x: x["score"], reverse=True)
        summary["total"] = len(assessed)
        return Response({"summary": summary, "participants": assessed})


@extend_schema(tags=["intelligence"], responses=OpenApiTypes.OBJECT)
class AnomalyFeed(APIView):
    """AI anomaly detection: cross-entity patterns (flipping, circular ownership,
    velocity spikes, shared-identifier rings, irregular flow, volume outliers)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or user.role in _ALLOWED):
            return Response({"detail": "Enforcement or regulator access required."}, status=403)

        from collections import defaultdict

        from django.contrib.auth import get_user_model

        from production.services import verify_chain
        from trading.models import OwnershipTransfer
        User = get_user_model()

        transfers = []
        for tr in (OwnershipTransfer.objects.select_related("seller", "buyer", "batch")
                   .order_by("-created_at")[:800]):
            transfers.append({
                "seller_id": tr.seller_id, "seller_name": tr.seller.username if tr.seller_id else None,
                "buyer_id": tr.buyer_id, "buyer_name": tr.buyer.username if tr.buyer_id else None,
                "batch_code": tr.batch.batch_code if tr.batch_id else None,
                "created_at": tr.created_at, "irregular": bool(getattr(tr, "irregular", False)),
            })

        gross_by_miner = defaultdict(float)
        batch_chains = []
        for b in (GoldBatch.objects.select_related("miner__user")
                  .prefetch_related("custody_events")[:400]):
            owners = []
            for e in b.custody_events.order_by("created_at"):
                to = e.metadata.get("to_party") if isinstance(e.metadata, dict) else None
                if to:
                    owners.append(to)
            batch_chains.append({"batch_code": b.batch_code, "owner_sequence": owners,
                                 "chain_valid": verify_chain(b)["valid"]})
            if b.miner and b.miner.user_id:
                gross_by_miner[b.miner.user_id] += float(b.gross_weight_g or 0)

        participants = []
        for u in User.objects.all()[:1000]:
            participants.append({
                "id": u.id, "username": u.username, "role": u.role,
                "phone": getattr(u, "phone", ""), "organization": getattr(u, "organization", ""),
                "total_gross_g": gross_by_miner.get(u.id, 0),
            })

        anomalies = detect_anomalies(transfers=transfers, participants=participants,
                                     batch_chains=batch_chains)
        summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for a in anomalies:
            summary[a["severity"]] = summary.get(a["severity"], 0) + 1
        summary["total"] = len(anomalies)
        return Response({"summary": summary, "anomalies": anomalies})
