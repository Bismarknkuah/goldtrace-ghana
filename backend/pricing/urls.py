from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import CurrentRateView, ReferenceRateViewSet

router = DefaultRouter()
router.register("rates", ReferenceRateViewSet, basename="reference-rate")

urlpatterns = [path("current/", CurrentRateView.as_view(), name="current-rate")] + router.urls
