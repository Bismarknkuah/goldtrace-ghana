"""Illegal-mining detection & prediction model.

A lightweight logistic-style scorer over geospatial features. It is the model
layer that a trained satellite-imagery classifier (e.g. a CNN over Sentinel-2
bare-soil / NDVI-loss indices) feeds: that classifier supplies `imagery_score`;
this model fuses it with concession geometry, spatial clustering of prior
detections/hotspots, and regional risk to produce a calibrated probability.
Without an imagery feed it still predicts from the spatial signals alone.
"""
from __future__ import annotations

import math

from .services import find_containing_concession, haversine_km

# Model weights (logit space). Tuned so an unlicensed site with nearby
# corroborating signals lands well above the alert threshold.
W = {
    "bias": -2.2,
    "outside_concession": 2.6,
    "distance_km_log": 0.35,     # farther from any licensed land -> more suspicious
    "hotspots_5km": 0.55,        # per hotspot within 5 km (capped)
    "illegal_detections_5km": 0.7,
    "region_risk": 0.02,         # per point of regional risk (0-100)
    "imagery_score": 2.4,        # from a satellite classifier, 0-1
}
ALERT_THRESHOLD = 0.6


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def features_for(lat: float, lng: float, *, concessions, hotspots, detections,
                 region_risk: float = 0.0, imagery_score: float | None = None) -> dict:
    inside = find_containing_concession(lat, lng, concessions)
    # distance to nearest concession centroid-ish (use first polygon vertex as proxy)
    nearest = None
    for c in concessions:
        geom = getattr(c, "geometry", None) or {}
        coords = (geom.get("coordinates") or [[]])[0]
        for pt in coords[:1]:
            try:
                d = haversine_km(lat, lng, pt[1], pt[0])
                nearest = d if nearest is None else min(nearest, d)
            except Exception:
                pass
    hs = sum(1 for h in hotspots if haversine_km(lat, lng, h.latitude, h.longitude) <= 5)
    il = sum(1 for d in detections
             if "illegal" in d.status and haversine_km(lat, lng, d.latitude, d.longitude) <= 5)
    return {
        "outside_concession": 0 if inside else 1,
        "distance_km": nearest if nearest is not None else 25.0,
        "hotspots_5km": min(hs, 6),
        "illegal_detections_5km": min(il, 6),
        "region_risk": region_risk,
        "imagery_score": imagery_score,
        "matched_concession": inside,
    }


def predict(feat: dict) -> dict:
    z = W["bias"]
    z += W["outside_concession"] * feat["outside_concession"]
    z += W["distance_km_log"] * math.log1p(feat["distance_km"]) * feat["outside_concession"]
    z += W["hotspots_5km"] * feat["hotspots_5km"]
    z += W["illegal_detections_5km"] * feat["illegal_detections_5km"]
    z += W["region_risk"] * feat["region_risk"]
    if feat.get("imagery_score") is not None:
        z += W["imagery_score"] * feat["imagery_score"]
    p = _sigmoid(z)
    band = "critical" if p >= 0.85 else "high" if p >= ALERT_THRESHOLD else "medium" if p >= 0.35 else "low"
    return {"probability": round(p, 3), "band": band, "alert": p >= ALERT_THRESHOLD,
            "drivers": [k for k in ("outside_concession", "hotspots_5km",
                                    "illegal_detections_5km", "imagery_score")
                        if feat.get(k)]}
