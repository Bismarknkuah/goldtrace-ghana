from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CheckPoint, ConcessionsGeoJSON, HotspotsGeoJSON, HotspotViewSet

router = DefaultRouter()
router.register("hotspots", HotspotViewSet, basename="hotspot")

urlpatterns = [
    path("concessions.geojson", ConcessionsGeoJSON.as_view(), name="gis-concessions"),
    path("hotspots.geojson", HotspotsGeoJSON.as_view(), name="gis-hotspots"),
    path("check-point/", CheckPoint.as_view(), name="gis-check-point"),
] + router.urls
