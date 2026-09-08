from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role

from .models import License, LicenseStatus
from .serializers import LicenseSerializer, RegistryLookupSerializer

ISSUER_ROLES = {Role.SUPER_ADMIN.value, Role.CEO.value, Role.GOLDBOD_OFFICER.value}


class LicensingPermission(IsAuthenticated):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.is_superuser or request.user.role in ISSUER_ROLES


@extend_schema(tags=["licensing"])
class LicenseViewSet(viewsets.ModelViewSet):
    serializer_class = LicenseSerializer
    permission_classes = [LicensingPermission]

    def get_queryset(self):
        qs = License.objects.select_related("holder").all()
        u = self.request.user
        if u.is_superuser or u.role in ISSUER_ROLES:
            return qs
        return qs.filter(holder=u)

    def perform_create(self, serializer):
        serializer.save(issued_by=self.request.user)

    def _set_status(self, request, status_value):
        lic = self.get_object()
        lic.status = status_value
        lic.save(update_fields=["status"])
        return Response(self.get_serializer(lic).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def request_renewal(self, request, pk=None):
        """Licence holder submits a renewal with a supporting document."""
        lic = self.get_object()
        if not (request.user.is_superuser or lic.holder_id == request.user.id):
            return Response({"detail": "You can only renew your own licence."}, status=403)
        lic.renewal_requested = True
        doc = request.data.get("renewal_document")
        if doc:
            lic.renewal_document = doc
        lic.save(update_fields=["renewal_requested", "renewal_document"])
        return Response(self.get_serializer(lic).data)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._set_status(request, LicenseStatus.SUSPENDED)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        return self._set_status(request, LicenseStatus.REVOKED)

    @action(detail=True, methods=["post"])
    def reinstate(self, request, pk=None):
        return self._set_status(request, LicenseStatus.ACTIVE)


@extend_schema(tags=["licensing"], responses=RegistryLookupSerializer)
class LicenseRegistryView(APIView):
    """Public License Registry — verify any operator by licence number."""
    permission_classes = [AllowAny]

    def get(self, request):
        number = request.query_params.get("number", "").strip()
        lic = License.objects.select_related("holder").filter(license_number__iexact=number).first()
        if not lic:
            return Response({"found": False, "number": number}, status=404)
        # auto-expire on read
        if lic.expires_at and lic.expires_at < timezone.now().date() and lic.status == LicenseStatus.ACTIVE:
            lic.status = LicenseStatus.EXPIRED
            lic.save(update_fields=["status"])
        return Response({"found": True, **RegistryLookupSerializer(lic).data})
