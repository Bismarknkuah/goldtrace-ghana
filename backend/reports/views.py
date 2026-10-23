from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role

from .models import PublicReport, ReportLink, ReportStatus
from .serializers import PublicReportSerializer, PublicSubmitSerializer, ReportLinkSerializer

MANAGERS = {Role.SUPER_ADMIN.value, Role.CEO.value, Role.GOLDBOD_OFFICER.value}
MAX_ATTACH = 8
MAX_ATTACH_BYTES = 8 * 1024 * 1024  # ~8 MB per file (base64 counted)


def _is_manager(u):
    return u.is_superuser or u.role in MANAGERS


@extend_schema(tags=["reports"])
class ReportLinkViewSet(viewsets.ModelViewSet):
    """CEO / admin generates and manages public share links."""
    serializer_class = ReportLinkSerializer
    permission_classes = [IsAuthenticated]
    queryset = ReportLink.objects.all().order_by("-created_at")

    def get_queryset(self):
        return super().get_queryset() if _is_manager(self.request.user) else ReportLink.objects.none()

    def perform_create(self, serializer):
        if not _is_manager(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the CEO or GoldBod admin can generate share links.")
        serializer.save(created_by=self.request.user)


@extend_schema(tags=["reports"])
class PublicReportFormView(APIView):
    """Public: validate a share link and return the form metadata."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        link = get_object_or_404(ReportLink, token=token, active=True)
        from .models import ReportCategory
        return Response({"title": link.title, "categories": [
            {"value": v, "label": l} for v, l in ReportCategory.choices]})


@extend_schema(tags=["reports"])
class PublicReportSubmitView(APIView):
    """Public: submit a report with optional photos/videos/files. A located
    report also creates a detection so it feeds the map and alerts."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        link = get_object_or_404(ReportLink, token=token, active=True)
        s = PublicSubmitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        atts = d.get("attachments") or []
        if len(atts) > MAX_ATTACH:
            return Response({"detail": f"At most {MAX_ATTACH} attachments."}, status=400)
        for a in atts:
            if len(str(a.get("data", ""))) > MAX_ATTACH_BYTES:
                return Response({"detail": f"'{a.get('name','file')}' is too large (max ~8 MB)."}, status=400)

        detection = None
        if d.get("latitude") is not None and d.get("longitude") is not None:
            from gis.models import DetectedMiningSite
            from gis.views import DetectedMiningSiteViewSet  # reuse reconciliation logic
            from gis.serializers import DetectedMiningSiteSerializer
            ds = DetectedMiningSiteSerializer(data={
                "latitude": d["latitude"], "longitude": d["longitude"],
                "region": d.get("region", ""), "source": "public_report",
                "confidence": 0.6, "operator_name": "",
                "note": f"Citizen report: {d['description'][:180]}"})
            ds.is_valid(raise_exception=True)
            vs = DetectedMiningSiteViewSet(); vs.request = request
            vs.perform_create(ds)
            detection = ds.instance

        report = PublicReport.objects.create(
            link=link, category=d["category"], description=d["description"],
            reporter_name=d.get("reporter_name", ""), reporter_phone=d.get("reporter_phone", ""),
            latitude=d.get("latitude"), longitude=d.get("longitude"),
            region=d.get("region", ""), location_text=d.get("location_text", ""),
            attachments=atts, detection=detection)
        ReportLink.objects.filter(pk=link.pk).update(submissions=link.submissions + 1)
        return Response({"detail": "Thank you. Your report has been received by GoldBod.",
                         "reference": str(report.id)[-8:].upper()}, status=status.HTTP_201_CREATED)


@extend_schema(tags=["reports"])
class PublicReportViewSet(viewsets.ReadOnlyModelViewSet):
    """Managers see all reports; assigned officers see the ones assigned to them."""
    serializer_class = PublicReportSerializer
    permission_classes = [IsAuthenticated]
    queryset = PublicReport.objects.prefetch_related("assigned_to").all()

    def get_queryset(self):
        u = self.request.user
        if _is_manager(u):
            return super().get_queryset()
        return super().get_queryset().filter(assigned_to=u)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        if not _is_manager(request.user):
            return Response({"detail": "Only the CEO or GoldBod admin can assign officers."}, status=403)
        from django.contrib.auth import get_user_model
        report = self.get_object()
        ids = request.data.get("user_ids", [])
        users = get_user_model().objects.filter(id__in=ids)
        report.assigned_to.set(users)
        if report.status == ReportStatus.NEW:
            report.status = ReportStatus.UNDER_REVIEW
            report.save(update_fields=["status"])
        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        report = self.get_object()
        st = request.data.get("status")
        if st not in ReportStatus.values:
            return Response({"detail": "Invalid status."}, status=400)
        report.status = st
        report.officer_note = request.data.get("note", report.officer_note)
        report.save(update_fields=["status", "officer_note"])
        return Response(self.get_serializer(report).data)
