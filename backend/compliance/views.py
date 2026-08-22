from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import REGULATOR_ROLES, Role
from production.models import GoldBatch

from .models import DueDiligence, KycScreening, ScreeningStatus
from .serializers import DueDiligenceSerializer, KycScreeningSerializer
from .services import screen_party

_ALLOWED = {r.value for r in REGULATOR_ROLES} | {Role.CUSTOMS_OFFICER.value}


class CompliancePermission(IsAuthenticated):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_superuser or u.role in _ALLOWED))


@extend_schema(tags=["compliance"])
class KycScreeningViewSet(viewsets.ModelViewSet):
    queryset = KycScreening.objects.all()
    serializer_class = KycScreeningSerializer
    permission_classes = [CompliancePermission]

    def perform_create(self, serializer):
        data = serializer.validated_data
        verdict = screen_party(data["subject_name"], data.get("country", ""))
        serializer.save(screened_by=self.request.user, **verdict)


@extend_schema(tags=["compliance"])
class DueDiligenceViewSet(viewsets.ModelViewSet):
    queryset = DueDiligence.objects.select_related("batch").all()
    serializer_class = DueDiligenceSerializer
    permission_classes = [CompliancePermission]

    def perform_create(self, serializer):
        serializer.save(attested_by=self.request.user)


@extend_schema(tags=["compliance"], responses=OpenApiTypes.OBJECT)
class ComplianceOverview(APIView):
    permission_classes = [CompliancePermission]

    def get(self, request):
        screenings = KycScreening.objects.all()
        by_status = {s.value: 0 for s in ScreeningStatus}
        for k in screenings:
            by_status[k.status] = by_status.get(k.status, 0) + 1

        total_batches = GoldBatch.objects.count()
        dd = list(DueDiligence.objects.all())
        responsible = sum(1 for d in dd if d.responsible)
        coverage = round((len(dd) / total_batches) * 100, 1) if total_batches else 0.0

        flagged = KycScreening.objects.exclude(status="cleared")[:50]
        return Response({
            "screening_counts": by_status,
            "due_diligence": {
                "attested": len(dd), "responsible": responsible,
                "total_batches": total_batches, "coverage_pct": coverage,
            },
            "flagged_parties": KycScreeningSerializer(flagged, many=True).data,
        })
