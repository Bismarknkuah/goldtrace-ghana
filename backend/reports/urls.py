from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PublicReportFormView, PublicReportSubmitView, PublicReportViewSet, ReportLinkViewSet

router = DefaultRouter()
router.register("links", ReportLinkViewSet, basename="report-link")
router.register("", PublicReportViewSet, basename="report")

urlpatterns = [
    path("public/<str:token>/", PublicReportFormView.as_view(), name="report-public-form"),
    path("public/<str:token>/submit/", PublicReportSubmitView.as_view(), name="report-public-submit"),
] + router.urls
