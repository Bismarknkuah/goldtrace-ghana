from rest_framework.routers import DefaultRouter

from .views import CourierViewSet, DeliveryRequestViewSet

router = DefaultRouter()
router.register("couriers", CourierViewSet, basename="courier")
router.register("deliveries", DeliveryRequestViewSet, basename="delivery")

urlpatterns = router.urls
