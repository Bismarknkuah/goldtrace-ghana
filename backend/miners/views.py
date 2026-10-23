from drf_spectacular.utils import extend_schema
from rest_framework import viewsets

from accounts.models import REGULATOR_ROLES
from core.scoping import scope_companies, scope_concessions, scope_miners

from .models import Concession, Miner, MinerDocument, MiningCompany
from .permissions import MinerAccessPolicy
from .serializers import (
    ConcessionSerializer,
    MinerDocumentSerializer,
    MinerSerializer,
    MiningCompanySerializer,
)


def _scope_to_user(qs, user, owner_path):
    """Regulators see everything; everyone else only their own miner records."""
    if user.is_superuser or user.role in {r.value for r in REGULATOR_ROLES}:
        return qs
    return qs.filter(**{owner_path: user})


@extend_schema(tags=["miners"])
class MinerViewSet(viewsets.ModelViewSet):
    serializer_class = MinerSerializer
    permission_classes = [MinerAccessPolicy]

    def get_queryset(self):
        return scope_miners(Miner.objects.select_related("user").all(), self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@extend_schema(tags=["miners"])
class ConcessionViewSet(viewsets.ModelViewSet):
    serializer_class = ConcessionSerializer
    permission_classes = [MinerAccessPolicy]

    def get_queryset(self):
        return scope_concessions(Concession.objects.select_related("miner").all(), self.request.user)


@extend_schema(tags=["miners"])
class MinerDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = MinerDocumentSerializer
    permission_classes = [MinerAccessPolicy]

    def get_queryset(self):
        return _scope_to_user(
            MinerDocument.objects.select_related("miner").all(),
            self.request.user, "miner__user",
        )


@extend_schema(tags=["miners"])
class MiningCompanyViewSet(viewsets.ModelViewSet):
    serializer_class = MiningCompanySerializer
    permission_classes = [MinerAccessPolicy]

    def get_queryset(self):
        return scope_companies(MiningCompany.objects.all(), self.request.user)
