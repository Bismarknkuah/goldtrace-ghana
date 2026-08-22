from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import SecurityIncidentViewSet, SecurityOverview

router = DefaultRouter()
router.register("incidents", SecurityIncidentViewSet, basename="incident")

urlpatterns = [path("overview/", SecurityOverview.as_view(), name="security-overview")] + router.urls
