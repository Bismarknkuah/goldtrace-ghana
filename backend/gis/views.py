from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
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
