from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import REGULATOR_ROLES
from production.models import BatchStatus, CustodyEventType
from production.services import append_custody_event, build_qr, verify_chain

from .models import CertificateStatus, ExportCertificate
from .serializers import CertificateVerifySerializer, ExportCertificateSerializer
from .services import certificate_hash


@extend_schema(tags=["exports"])
class ExportCertificateViewSet(viewsets.ModelViewSet):
    serializer_class = ExportCertificateSerializer

    def get_throttles(self):
        if getattr(self, "action", None) == "verify":
            self.throttle_scope = "verify"
        return super().get_throttles()

    def get_queryset(self):
        user = self.request.user
        qs = ExportCertificate.objects.select_related("batch", "exporter")
        if user.is_superuser or user.role in {r.value for r in REGULATOR_ROLES}:
            return qs
        return qs.filter(exporter=user)

    def perform_create(self, serializer):
        serializer.save(exporter=self.request.user)

    @extend_schema(tags=["exports"])
    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        """Issue the certificate — only if the batch custody chain verifies."""
        cert = self.get_object()
        if cert.status == CertificateStatus.ISSUED:
            raise ValidationError("Certificate already issued.")

        chain = verify_chain(cert.batch)
        if not chain["valid"]:
            raise ValidationError("Custody chain failed verification; cannot certify.")

        cert.certificate_hash = certificate_hash(cert)
        cert.qr_image = build_qr(
            f"{settings.GOLD_PASSPORT_BASE_URL}/cert/{cert.certificate_number}",
            f"{cert.certificate_number}.png",
        )
        cert.status = CertificateStatus.ISSUED
        cert.issued_by = request.user
        cert.issued_at = timezone.now()
        cert.save(update_fields=[
            "certificate_hash", "qr_image", "status", "issued_by", "issued_at",
        ])

        cert.batch.status = BatchStatus.EXPORTED
        cert.batch.save(update_fields=["status"])
        append_custody_event(
            cert.batch, CustodyEventType.EXPORT, actor=request.user,
            to_party=cert.destination_country,
            metadata={"certificate": cert.certificate_number},
        )
        return Response(self.get_serializer(cert).data, status=status.HTTP_200_OK)

    @extend_schema(tags=["exports"], responses=CertificateVerifySerializer)
    @action(detail=False, methods=["get"])
    def verify(self, request):
        number = request.query_params.get("number", "")
        cert = get_object_or_404(ExportCertificate, certificate_number=number)
        chain = verify_chain(cert.batch)
        recomputed = certificate_hash(cert)
        payload = {
            "certificate_number": cert.certificate_number,
            "status": cert.get_status_display(),
            "batch_code": cert.batch.batch_code,
            "destination_country": cert.destination_country,
            "fine_weight_g": cert.fine_weight_g,
            "certificate_hash": cert.certificate_hash,
            "chain_valid": chain["valid"],
            "valid": (
                cert.status == CertificateStatus.ISSUED
                and chain["valid"]
                and recomputed == cert.certificate_hash
            ),
        }
        return Response(CertificateVerifySerializer(payload).data, status=status.HTTP_200_OK)
