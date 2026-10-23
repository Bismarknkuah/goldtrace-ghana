from django.urls import path

from .views import AnomalyFeed, ComplianceMapView, RecommendationsView, ParticipantRiskView, RiskOverview

urlpatterns = [
    path("risk/", RiskOverview.as_view(), name="intel-risk"),
    path("anomalies/", AnomalyFeed.as_view(), name="intel-anomalies"),
    path("compliance-map/", ComplianceMapView.as_view(), name="intel-compliance-map"),
    path("recommendations/", RecommendationsView.as_view(), name="intel-recommendations"),
    path("participants/", ParticipantRiskView.as_view(), name="intel-participants"),
]
