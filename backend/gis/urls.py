from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DetectedMiningSiteViewSet, EnvironmentalRiskView, IllegalMiningAlertsView, CheckPoint, ConcessionsGeoJSON, HotspotsGeoJSON, HotspotViewSet

router = DefaultRouter()
router.register("hotspots", HotspotViewSet, basename="hotspot")

urlpatterns = [
    path("environmental-risk/", EnvironmentalRiskView.as_view(), name="env-risk"),
    path("illegal-mining-alerts/", IllegalMiningAlertsView.as_view(), name="illegal-alerts"),
    path("concessions.geojson", ConcessionsGeoJSON.as_view(), name="gis-concessions"),
    path("hotspots.geojson", HotspotsGeoJSON.as_view(), name="gis-hotspots"),
    path("check-point/", CheckPoint.as_view(), name="gis-check-point"),
] + router.urls

_router = DefaultRouter()
_router.register("detections", DetectedMiningSiteViewSet, basename="detection")
urlpatterns += _router.urls
