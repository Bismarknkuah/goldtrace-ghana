from rest_framework.routers import DefaultRouter

from .views import ExportCertificateViewSet

router = DefaultRouter()
router.register("certificates", ExportCertificateViewSet, basename="certificate")

urlpatterns = router.urls
