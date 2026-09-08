from rest_framework.routers import DefaultRouter

from .views import OwnershipTransferViewSet, PaymentReceiptViewSet

router = DefaultRouter()
router.register("transfers", OwnershipTransferViewSet, basename="transfer")
router.register("receipts", PaymentReceiptViewSet, basename="receipt")

urlpatterns = router.urls
