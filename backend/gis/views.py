from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from miners.models import Concession

from .models import Hotspot
from .serializers import HotspotSerializer
from .services import (
    concession_feature,
    find_containing_concession,
    haversine_km,
    hotspot_feature,
)


@extend_schema(tags=["gis"], responses=OpenApiTypes.OBJECT)
class ConcessionsGeoJSON(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        features = [concession_feature(c) for c in Concession.objects.all() if c.boundary]
        return Response({"type": "FeatureCollection", "features": features})


@extend_schema(tags=["gis"], responses=OpenApiTypes.OBJECT)
class HotspotsGeoJSON(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Hotspot.objects.all()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response({
            "type": "FeatureCollection",
            "features": [hotspot_feature(h) for h in qs],
        })


@extend_schema(tags=["gis"], responses=OpenApiTypes.OBJECT)
class CheckPoint(APIView):
    """Is a coordinate inside a licensed concession? Which hotspots are nearby?"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            lat = float(request.query_params["lat"])
            lng = float(request.query_params["lng"])
        except (KeyError, ValueError):
            return Response({"detail": "lat and lng query params are required."}, status=400)

        concession = find_containing_concession(
            lat, lng, Concession.objects.filter(is_active=True),
        )
        radius = float(request.query_params.get("radius_km", 25))
        nearby = [
            {**hotspot_feature(h)["properties"],
             "distance_km": round(haversine_km(lat, lng, h.latitude, h.longitude), 2)}
            for h in Hotspot.objects.all()
            if haversine_km(lat, lng, h.latitude, h.longitude) <= radius
        ]
        nearby.sort(key=lambda x: x["distance_km"])
        return Response({
            "inside_licensed_concession": bool(concession),
            "concession": concession.code if concession else None,
            "flag_illegal_origin": not bool(concession),
            "nearby_hotspots": nearby,
        })


@extend_schema(tags=["gis"])
class HotspotViewSet(viewsets.ModelViewSet):
    queryset = Hotspot.objects.all()
    serializer_class = HotspotSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)


@extend_schema(tags=["gis"], responses=OpenApiTypes.OBJECT)
class EnvironmentalRiskView(APIView):
    """Environmental risk register (vision 13): score each mining region from
    illegal-mining hotspot activity so environmental officers can prioritise inspections."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from collections import defaultdict

        from accounts.models import Role
        u = request.user
        allowed = {Role.SUPER_ADMIN.value, Role.CEO.value, Role.GOLDBOD_OFFICER.value,
                   Role.ENV_OFFICER.value, Role.MINISTRY_OFFICIAL.value,
                   Role.INDEPENDENT_AUDITOR.value}
        if not (u.is_superuser or u.role in allowed):
            return Response({"detail": "Environmental / oversight access required."}, status=403)

        from miners.models import Miner
        from production.models import GoldBatch

        weight = {"high": 30, "medium": 15, "low": 6}
        by_region = defaultdict(lambda: {"hotspots": 0, "score": 0, "active_sites": 0})
        for h in Hotspot.objects.all():
            r = by_region[h.region or "Unspecified"]
            r["hotspots"] += 1
            r["score"] += weight.get(h.severity, 10)
        for m in Miner.objects.all():
            if m.region:
                by_region[m.region]["active_sites"] += 1

        rows = []
        for region, d in by_region.items():
            score = min(100, d["score"] + d["active_sites"] * 3)
            band = ("critical" if score >= 70 else "high" if score >= 45
                    else "medium" if score >= 25 else "low")
            rows.append({"region": region, "hotspots": d["hotspots"],
                         "active_sites": d["active_sites"], "risk_score": score, "band": band})
        rows.sort(key=lambda x: -x["risk_score"])
        return Response({"regions": rows})


@extend_schema(tags=["gis"])
class DetectedMiningSiteViewSet(viewsets.ModelViewSet):
    """Satellite / field detections of mining activity, auto-reconciled against
    licensed concessions. Ingest via POST (the seam a satellite provider feeds)."""
    from .models import DetectedMiningSite as _M
    from .serializers import DetectedMiningSiteSerializer as _S
    queryset = _M.objects.select_related("matched_concession").all()
    serializer_class = _S
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from core.scoping import has_full_visibility
        from accounts.models import Role
        u = self.request.user
        if u.is_superuser or has_full_visibility(u) or u.role == Role.ENV_OFFICER:
            return super().get_queryset()
        return super().get_queryset().none()

    def perform_create(self, serializer):
        """Reconcile: inside a licensed concession -> LICENSED; otherwise SUSPECTED
        ILLEGAL, and a hotspot is raised so officers can act."""
        from miners.models import Concession
        from .models import DetectionStatus, Hotspot, Severity
        from .services import find_containing_concession
        lat = serializer.validated_data["latitude"]
        lng = serializer.validated_data["longitude"]
        match = find_containing_concession(lat, lng, Concession.objects.all())
        if match is not None:
            obj = serializer.save(status=DetectionStatus.LICENSED, matched_concession=match)
        else:
            obj = serializer.save(status=DetectionStatus.SUSPECTED_ILLEGAL)
            Hotspot.objects.create(
                title=f"Satellite: suspected illegal mining ({obj.region or 'unknown region'})",
                latitude=lat, longitude=lng, region=obj.region,
                severity=Severity.HIGH if (obj.confidence or 0) >= 0.7 else Severity.MEDIUM,
                description=(f"Detected by {obj.source} (confidence {obj.confidence:.0%}). "
                             f"No licensed concession covers this location."),
            )

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        """Officer disposition: confirm illegal, mark licensed, or dismiss."""
        from .models import DetectionStatus
        obj = self.get_object()
        st = request.data.get("status")
        if st not in DetectionStatus.values:
            return Response({"detail": "Invalid status."}, status=400)
        obj.status = st
        obj.note = request.data.get("note", obj.note)
        obj.save(update_fields=["status", "note"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["get"])
    def geojson(self, request):
        feats = []
        for d in self.get_queryset():
            feats.append({"type": "Feature",
                          "geometry": {"type": "Point", "coordinates": [d.longitude, d.latitude]},
                          "properties": {"id": str(d.id), "status": d.status,
                                         "status_display": d.get_status_display(),
                                         "confidence": d.confidence, "region": d.region,
                                         "source": d.source, "operator": d.operator_name,
                                         "concession": (d.matched_concession.reference
                                                        if d.matched_concession_id else None)}})
        return Response({"type": "FeatureCollection", "features": feats})


@extend_schema(tags=["gis"], responses=OpenApiTypes.OBJECT)
class IllegalMiningAlertsView(APIView):
    """Targeted alerts for compliance roles (CEO, GoldBod officer, environmental
    officer, security, auditor): every predicted or detected illegal-mining
    location with exact coordinates, ranked by model probability."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from accounts.models import Role
        u = request.user
        allowed = {Role.SUPER_ADMIN.value, Role.CEO.value, Role.GOLDBOD_OFFICER.value,
                   Role.ENV_OFFICER.value, Role.SECURITY_AGENCY.value,
                   Role.CUSTOMS_OFFICER.value, Role.MINISTRY_OFFICIAL.value,
                   Role.INDEPENDENT_AUDITOR.value}
        if not (u.is_superuser or u.role in allowed):
            return Response({"detail": "Compliance oversight access required."}, status=403)

        from collections import defaultdict

        from .detector import features_for, predict
        from .models import DetectedMiningSite, Hotspot

        concessions = list(Concession.objects.all())
        hotspots = list(Hotspot.objects.all())
        detections = list(DetectedMiningSite.objects.all())

        # Regional risk (same scoring as the environmental register).
        weight = {"high": 30, "medium": 15, "low": 6}
        region_score = defaultdict(int)
        for h in hotspots:
            region_score[h.region or ""] += weight.get(h.severity, 10)

        alerts = []
        seen = set()
        # 1. Score every detection and every hotspot as a candidate location.
        candidates = [(d.latitude, d.longitude, d.region, "detection", d) for d in detections]
        candidates += [(h.latitude, h.longitude, h.region, "hotspot", h) for h in hotspots]
        for lat, lng, region, kind, obj in candidates:
            key = (round(lat, 3), round(lng, 3))
            if key in seen:
                continue
            seen.add(key)
            feat = features_for(lat, lng, concessions=concessions, hotspots=hotspots,
                                detections=detections,
                                region_risk=min(100, region_score.get(region or "", 0)),
                                imagery_score=(obj.confidence if kind == "detection" else None))
            pred = predict(feat)
            if not pred["alert"] and feat["outside_concession"] == 0:
                continue
            alerts.append({
                "latitude": lat, "longitude": lng, "region": region or "Unknown",
                "source": kind, "probability": pred["probability"], "band": pred["band"],
                "drivers": pred["drivers"],
                "status": getattr(obj, "status", None),
                "maps_link": f"https://www.google.com/maps?q={lat},{lng}",
            })
        alerts.sort(key=lambda a: -a["probability"])
        summary = {"total": len(alerts),
                   "critical": sum(1 for a in alerts if a["band"] == "critical"),
                   "high": sum(1 for a in alerts if a["band"] == "high")}
        return Response({"summary": summary, "alerts": alerts[:50]})
