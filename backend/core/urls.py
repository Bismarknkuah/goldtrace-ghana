from django.urls import path

from .views import AuditLedgerVerify, RoleFeaturesView, SystemConfigView

urlpatterns = [
    path("audit/verify/", AuditLedgerVerify.as_view(), name="audit-verify"),
    path("features/", RoleFeaturesView.as_view(), name="role-features"),
    path("config/", SystemConfigView.as_view(), name="system-config"),
]
