from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MyComplianceView, OwnershipTransferViewSet, PaymentReceiptViewSet, TradingRulesView

router = DefaultRouter()
router.register("transfers", OwnershipTransferViewSet, basename="transfer")
router.register("receipts", PaymentReceiptViewSet, basename="receipt")

urlpatterns = [
    path("rules/", TradingRulesView.as_view(), name="trading-rules"),
    path("my-compliance/", MyComplianceView.as_view(), name="my-compliance"),
] + router.urls
