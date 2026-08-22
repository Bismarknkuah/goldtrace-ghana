from rest_framework.routers import DefaultRouter

from .views import (ConcessionViewSet, MinerDocumentViewSet, MinerViewSet,
                    MiningCompanyViewSet)

router = DefaultRouter()
router.register("miners", MinerViewSet, basename="miner")
router.register("concessions", ConcessionViewSet, basename="concession")
router.register("documents", MinerDocumentViewSet, basename="miner-document")
router.register("companies", MiningCompanyViewSet, basename="mining-company")

urlpatterns = router.urls
