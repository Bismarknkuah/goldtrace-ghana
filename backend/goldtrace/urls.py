"""Root URL configuration for GOLDTRACE GHANA."""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def health(_request):
    return JsonResponse({"service": "goldtrace", "status": "ok"})


api_v1 = [
    path("auth/", include("accounts.urls")),
    path("", include("miners.urls")),
    path("production/", include("production.urls")),
    path("trading/", include("trading.urls")),
    path("exports/", include("exports.urls")),
    path("gis/", include("gis.urls")),
    path("logistics/", include("logistics.urls")),
    path("intelligence/", include("intelligence.urls")),
    path("revenue/", include("revenue.urls")),
    path("security/", include("security.urls")),
    path("compliance/", include("compliance.urls")),
    path("licensing/", include("licensing.urls")),
    path("pricing/", include("pricing.urls")),
]

urlpatterns = [
    path("", health),
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api"), namespace="v1")),
    # OpenAPI schema + interactive docs (deliverable #28)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
