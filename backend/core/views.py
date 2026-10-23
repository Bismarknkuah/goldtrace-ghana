from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import render

# Create your views here.


class AuditLedgerVerify(APIView):
    """Verify the tamper-evident audit ledger's hash chain (oversight only)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.audit_ledger import verify_chain
        from core.scoping import has_full_visibility
        if not has_full_visibility(request.user):
            return Response({"detail": "Oversight access required."}, status=403)
        return Response(verify_chain())


class RoleFeaturesView(APIView):
    """GET: all role->features (admin) or the caller's own (anyone).
    PUT: admin sets the enabled features for a role. Empty list = use defaults."""
    permission_classes = [permissions.IsAuthenticated]

    def _is_admin(self, u):
        return u.is_superuser or u.role in ("super_admin", "ceo")

    def get(self, request):
        from core.models import RoleFeatures
        if request.query_params.get("all") and self._is_admin(request.user):
            return Response({r.role: r.features for r in RoleFeatures.objects.all()})
        rf = RoleFeatures.objects.filter(role=request.user.role).first()
        return Response({"role": request.user.role, "features": rf.features if rf else None})

    def put(self, request):
        from core.models import RoleFeatures
        if not self._is_admin(request.user):
            return Response({"detail": "Admin access required."}, status=403)
        role = request.data.get("role")
        features = request.data.get("features")
        if not role or not isinstance(features, list):
            return Response({"detail": "Provide role and a features list."}, status=400)
        rf, _ = RoleFeatures.objects.update_or_create(role=role, defaults={"features": features})
        return Response({"role": rf.role, "features": rf.features})


class SystemConfigView(APIView):
    """GET: current operating settings. PUT (admin): update them."""
    permission_classes = [permissions.IsAuthenticated]
    FIELDS = ("org_name", "tagline", "contact_email", "report_form_title",
              "risk_block_threshold", "risk_review_threshold", "mass_balance_tolerance_pct",
              "fx_discrepancy_pct", "max_report_attachments")

    def _dump(self, c):
        return {f: getattr(c, f) for f in self.FIELDS}

    def get(self, request):
        from core.models import SystemConfig
        return Response(self._dump(SystemConfig.get()))

    def put(self, request):
        from core.models import SystemConfig
        if not (request.user.is_superuser or request.user.role in ("super_admin", "ceo")):
            return Response({"detail": "Admin access required."}, status=403)
        c = SystemConfig.get()
        for f in self.FIELDS:
            if f in request.data:
                setattr(c, f, request.data[f])
        c.save()
        return Response(self._dump(c))
