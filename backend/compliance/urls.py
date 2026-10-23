from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import ComplianceOverview, DueDiligenceViewSet, KycScreeningViewSet

router = DefaultRouter()
router.register("kyc", KycScreeningViewSet, basename="kyc")
router.register("due-diligence", DueDiligenceViewSet, basename="due-diligence")

urlpatterns = [path("overview/", ComplianceOverview.as_view(), name="compliance-overview")] + router.urls
