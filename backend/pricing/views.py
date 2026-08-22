from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role

from .models import ReferenceRate
from .serializers import ReferenceRateSerializer
from .services import current_rate

SETTER_ROLES = {Role.SUPER_ADMIN.value, Role.CEO.value, Role.BOG_OFFICER.value}


class RatePermission(IsAuthenticated):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.is_superuser or request.user.role in SETTER_ROLES


@extend_schema(tags=["pricing"])
class ReferenceRateViewSet(viewsets.ModelViewSet):
    queryset = ReferenceRate.objects.all()
    serializer_class = ReferenceRateSerializer
    permission_classes = [RatePermission]

    def perform_create(self, serializer):
        serializer.save(set_by=self.request.user)


@extend_schema(tags=["pricing"], responses=OpenApiTypes.OBJECT)
class CurrentRateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"rate_ghs_per_g": str(current_rate()),
                         "source": "Bank of Ghana Reference Rate"})
