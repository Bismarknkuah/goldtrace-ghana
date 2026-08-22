from django.urls import path

from .views import PublicTransparencyView, RevenueOverview

urlpatterns = [
    path("transparency/", PublicTransparencyView.as_view(), name="transparency"),path("overview/", RevenueOverview.as_view(), name="revenue-overview")]
