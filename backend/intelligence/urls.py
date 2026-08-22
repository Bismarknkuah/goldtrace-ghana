from django.urls import path

from .views import AnomalyFeed, ParticipantRiskView, RiskOverview

urlpatterns = [
    path("risk/", RiskOverview.as_view(), name="intel-risk"),
    path("anomalies/", AnomalyFeed.as_view(), name="intel-anomalies"),
    path("participants/", ParticipantRiskView.as_view(), name="intel-participants"),
]
