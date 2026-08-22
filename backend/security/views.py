from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ENFORCEMENT_ROLES, REGULATOR_ROLES
from production.models import GoldBatch, SecurityStatus

from .models import IncidentStatus, IncidentType, SecurityIncident
from .serializers import SecurityIncidentSerializer
from .services import at_risk_batches

_ALLOWED = {r.value for r in REGULATOR_ROLES} | {r.value for r in ENFORCEMENT_ROLES}

_TYPE_TO_STATUS = {
    IncidentType.MISSING: SecurityStatus.MISSING,
    IncidentType.STOLEN: SecurityStatus.STOLEN,
    IncidentType.TAMPER: SecurityStatus.FLAGGED,
    IncidentType.UNACCOUNTED: SecurityStatus.FLAGGED,
}


@extend_schema(tags=["security"])
class SecurityIncidentViewSet(viewsets.ModelViewSet):
    queryset = SecurityIncident.objects.select_related("batch").all()
    serializer_class = SecurityIncidentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        incident = serializer.save(reported_by=self.request.user)
        batch = incident.batch
        batch.security_status = _TYPE_TO_STATUS.get(incident.incident_type, SecurityStatus.FLAGGED)
        batch.save(update_fields=["security_status"])

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """Mark the gold recovered and the incident closed."""
        incident = self.get_object()
        incident.status = IncidentStatus.RECOVERED
        incident.resolved_at = timezone.now()
        incident.save(update_fields=["status", "resolved_at"])
        incident.batch.security_status = SecurityStatus.RECOVERED
        incident.batch.save(update_fields=["security_status"])
        return Response(self.get_serializer(incident).data)


@extend_schema(tags=["security"], responses=OpenApiTypes.OBJECT)
class SecurityOverview(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or user.role in _ALLOWED):
            return Response({"detail": "Enforcement or regulator access required."}, status=403)

        batches = list(GoldBatch.objects.prefetch_related("custody_events"))
        counts = {s.value: 0 for s in SecurityStatus}
        for b in batches:
            counts[b.security_status] = counts.get(b.security_status, 0) + 1

        incidents = SecurityIncident.objects.select_related("batch").exclude(
            status__in=[IncidentStatus.RECOVERED, IncidentStatus.CLOSED])[:50]
        return Response({
            "status_counts": counts,
            "at_risk": at_risk_batches(batches),
            "open_incidents": SecurityIncidentSerializer(incidents, many=True).data,
        })
