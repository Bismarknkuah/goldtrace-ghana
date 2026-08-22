from rest_framework.routers import DefaultRouter

from .views import AssayViewSet, GoldBatchViewSet

router = DefaultRouter()
router.register("assays", AssayViewSet, basename="assay")
router.register("batches", GoldBatchViewSet, basename="batch")

urlpatterns = router.urls
