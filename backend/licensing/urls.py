from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import LicenseRegistryView, LicenseViewSet

router = DefaultRouter()
router.register("licenses", LicenseViewSet, basename="license")

urlpatterns = [path("registry/", LicenseRegistryView.as_view(), name="license-registry")] + router.urls
