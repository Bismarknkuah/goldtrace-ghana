"""Records every state-changing API call to the audit trail."""
import logging

logger = logging.getLogger("goldtrace.audit")
_TRACKED = {"POST", "PUT", "PATCH", "DELETE"}


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.method in _TRACKED and request.path.startswith("/api/"):
            try:
                self._write(request, response)
            except Exception:  # auditing must never break the request
                logger.exception("audit write failed")
        return response

    def _write(self, request, response):
        from core.models import AuditLog

        user = getattr(request, "user", None)
        AuditLog.objects.create(
            actor=user if getattr(user, "is_authenticated", False) else None,
            actor_role=getattr(user, "role", "") or "",
            method=request.method,
            path=request.path[:255],
            status_code=response.status_code,
            ip_address=self._client_ip(request),
        )

    @staticmethod
    def _client_ip(request):
        fwd = request.META.get("HTTP_X_FORWARDED_FOR")
        return fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")
