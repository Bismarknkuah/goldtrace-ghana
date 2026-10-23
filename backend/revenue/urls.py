from django.urls import path

from .views import FxReconciliationView, PublicTransparencyView, RevenueOverview

urlpatterns = [
    path("transparency/", PublicTransparencyView.as_view(), name="transparency"),
    path("fx-reconciliation/", FxReconciliationView.as_view(), name="fx-reconciliation"),path("overview/", RevenueOverview.as_view(), name="revenue-overview")]
