from collections import defaultdict
from decimal import Decimal

from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.db import models
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AUDITOR_ROLES, REGULATOR_ROLES
from exports.models import CertificateStatus, ExportCertificate

from .services import export_value_ghs, royalty_ghs

_ALLOWED = {r.value for r in REGULATOR_ROLES} | {r.value for r in AUDITOR_ROLES}


@extend_schema(tags=["revenue"], responses=OpenApiTypes.OBJECT)
class RevenueOverview(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or user.role in _ALLOWED):
            return Response({"detail": "Regulator, BoG or ministry access required."}, status=403)

        from pricing.services import current_rate
        price = float(current_rate())
        rate = settings.MINERAL_ROYALTY_RATE

        certs = ExportCertificate.objects.filter(
            status=CertificateStatus.ISSUED).select_related("batch")

        total_value = Decimal("0")
        total_royalty = Decimal("0")
        total_fine = Decimal("0")
        by_dest = defaultdict(lambda: {"value": Decimal("0"), "royalty": Decimal("0"), "count": 0})
        rows = []
        for c in certs:
            value = export_value_ghs(c.fine_weight_g, price)
            royalty = royalty_ghs(value, rate)
            total_value += value
            total_royalty += royalty
            total_fine += Decimal(str(c.fine_weight_g or 0))
            d = by_dest[c.destination_country]
            d["value"] += value
            d["royalty"] += royalty
            d["count"] += 1
            rows.append({
                "certificate_number": c.certificate_number, "batch_code": c.batch.batch_code,
                "destination": c.destination_country, "fine_weight_g": str(c.fine_weight_g),
                "value_ghs": str(value), "royalty_ghs": str(royalty),
                "issued_at": c.issued_at,
            })

        return Response({
            "assumptions": {"gold_price_ghs_per_g": price, "royalty_rate": rate},
            "summary": {
                "export_count": len(rows),
                "total_fine_weight_g": str(total_fine),
                "total_export_value_ghs": str(total_value),
                "total_royalty_ghs": str(total_royalty),
            },
            "by_destination": [
                {"destination": k, "value_ghs": str(v["value"]),
                 "royalty_ghs": str(v["royalty"]), "count": v["count"]}
                for k, v in sorted(by_dest.items(), key=lambda x: x[1]["value"], reverse=True)
            ],
            "certificates": rows,
        })


@extend_schema(tags=["revenue"], responses=OpenApiTypes.OBJECT)
class PublicTransparencyView(APIView):
    """Public regulatory transparency: aggregate national figures only — no
    commercially sensitive, per-operator or per-transaction detail is exposed."""
    permission_classes = [AllowAny]

    def get(self, request):
        from decimal import Decimal

        from django.db.models import Avg, Count, Sum
        from licensing.models import License, LicenseStatus
        from pricing.services import current_rate
        from production.models import BatchStatus, GoldBatch

        price = float(current_rate())
        rate = settings.MINERAL_ROYALTY_RATE

        batches = GoldBatch.objects.all()
        agg = batches.aggregate(
            total=Count("id"),
            gross=Sum("gross_weight_g"),
            fine=Sum("fine_weight_g"),
            avg_fineness=Avg("fineness"),
        )

        # Regional production (by the originating miner's region).
        region_rows = (batches.values("miner__region")
                       .annotate(batches=Count("id"), gross=Sum("gross_weight_g"))
                       .order_by("-batches"))
        by_region = [{
            "region": r["miner__region"] or "Unspecified",
            "batches": r["batches"],
            "gross_weight_g": str(r["gross"] or 0),
        } for r in region_rows]

        # Exports + value.
        certs = ExportCertificate.objects.filter(status=CertificateStatus.ISSUED)
        exp_value = Decimal("0")
        exp_royalty = Decimal("0")
        exp_fine = Decimal("0")
        by_dest = defaultdict(lambda: {"value": Decimal("0"), "count": 0})
        for c in certs:
            v = export_value_ghs(c.fine_weight_g, price)
            exp_value += v
            exp_royalty += royalty_ghs(v, rate)
            exp_fine += Decimal(str(c.fine_weight_g or 0))
            d = by_dest[c.destination_country]
            d["value"] += v
            d["count"] += 1

        lic = License.objects.aggregate(
            active=Count("id", filter=models.Q(status=LicenseStatus.ACTIVE)),
            suspended=Count("id", filter=models.Q(status=LicenseStatus.SUSPENDED)),
            revoked=Count("id", filter=models.Q(status=LicenseStatus.REVOKED)),
        )

        return Response({
            "reference_rate_ghs_per_g": price,
            "production": {
                "total_batches": agg["total"] or 0,
                "gross_weight_g": str(agg["gross"] or 0),
                "fine_weight_g": str(agg["fine"] or 0),
                "average_fineness": round(agg["avg_fineness"] or 0),
                "exported_batches": batches.filter(status=BatchStatus.EXPORTED).count(),
            },
            "exports": {
                "export_count": certs.count(),
                "fine_weight_g": str(exp_fine),
                "total_value_ghs": str(exp_value.quantize(Decimal("1."))),
                "total_royalty_ghs": str(exp_royalty.quantize(Decimal("1."))),
                "fx_generated_usd": str((exp_value / Decimal("15")).quantize(Decimal("1."))),
            },
            "by_region": by_region,
            "by_destination": [
                {"destination": k, "value_ghs": str(v["value"].quantize(Decimal("1."))),
                 "count": v["count"]} for k, v in by_dest.items()],
            "licensing": {
                "active": lic["active"], "suspended": lic["suspended"], "revoked": lic["revoked"]},
        })


@extend_schema(tags=["revenue"], responses=OpenApiTypes.OBJECT)
class FxReconciliationView(APIView):
    """Bank of Ghana view: reconcile each export's expected value against the
    declared FX, and flag material discrepancies for authorised review (vision 14)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from decimal import Decimal

        from accounts.models import Role
        u = request.user
        allowed = {Role.SUPER_ADMIN.value, Role.CEO.value, Role.GOLDBOD_OFFICER.value,
                   Role.BOG_OFFICER.value, Role.MINISTRY_OFFICIAL.value,
                   Role.INDEPENDENT_AUDITOR.value}
        if not (u.is_superuser or u.role in allowed):
            return Response({"detail": "Bank of Ghana / oversight access required."}, status=403)

        from pricing.services import current_rate
        price = float(current_rate())
        usd_rate = Decimal("15")  # indicative GHS per USD for the reconciliation view

        rows = []
        flagged = 0
        for c in ExportCertificate.objects.filter(status=CertificateStatus.ISSUED).select_related("exporter"):
            expected_ghs = export_value_ghs(c.fine_weight_g, price)
            expected_usd = (expected_ghs / usd_rate).quantize(Decimal("1."))
            declared = c.declared_fx_usd
            if declared is None:
                status_ = "missing"
                flagged += 1
            else:
                gap = abs(declared - expected_usd)
                pct = (gap / expected_usd * 100) if expected_usd else Decimal("0")
                from core.models import SystemConfig
                status_ = "flagged" if pct > Decimal(str(SystemConfig.get().fx_discrepancy_pct)) else "reconciled"
                if status_ == "flagged":
                    flagged += 1
            rows.append({
                "certificate": c.certificate_number, "destination": c.destination_country,
                "exporter": c.exporter.username if c.exporter_id else None,
                "fine_weight_g": str(c.fine_weight_g),
                "expected_usd": str(expected_usd),
                "declared_usd": str(declared) if declared is not None else None,
                "status": status_,
            })
        return Response({"summary": {"total": len(rows), "flagged": flagged}, "rows": rows})
