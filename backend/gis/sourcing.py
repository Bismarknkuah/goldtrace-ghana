"""Responsible-sourcing check: is a gold lot's origin legitimate?

Links traceability to illegal-mining intelligence: a lot whose recorded origin
lies outside every licensed concession, or close to a detected illegal-mining
site, is flagged — so illegal gold is caught at the moment someone tries to
trade it, and investigators can see which lots may have come from a site.
"""
from __future__ import annotations

from .ghana import in_ghana
from .services import find_containing_concession, haversine_km

NEAR_ILLEGAL_KM = 2.0   # within this distance of a suspected/confirmed illegal site
NEAR_HOTSPOT_KM = 2.0


def lot_origin(batch):
    """Best precise origin for a lot: captured GPS, else recorded source point."""
    if batch.origin_latitude is not None and in_ghana(batch.origin_latitude, batch.origin_longitude):
        return batch.origin_latitude, batch.origin_longitude, "gps"
    coords = (batch.source_point or {}).get("coordinates")
    if coords and in_ghana(coords[1], coords[0]):
        return coords[1], coords[0], "source_point"
    return None


def source_check(batch, *, concessions=None, detections=None, hotspots=None) -> dict:
    """Return a sourcing verdict for one lot.

    status: "verified"   — origin inside the lot's licensed concession, no illegal site nearby
            "unverified" — no precise origin captured, cannot check
            "outside"    — origin is outside every licensed concession
            "illegal"    — origin is at / next to a confirmed illegal-mining site
            "suspect"    — origin near a suspected illegal site or high-severity hotspot
    """
    from miners.models import Concession

    from .models import DetectedMiningSite, Hotspot

    origin = lot_origin(batch)
    if origin is None:
        return {"status": "unverified", "origin": None, "concession": None, "nearest_illegal": None,
                "message": "No GPS origin was captured, so the mine site cannot be verified."}
    lat, lng, basis = origin
    concessions = list(Concession.objects.filter(is_active=True)) if concessions is None else concessions
    detections = (list(DetectedMiningSite.objects.filter(status__in=["suspected_illegal", "confirmed_illegal"]))
                  if detections is None else detections)
    hotspots = list(Hotspot.objects.exclude(status="resolved")) if hotspots is None else hotspots

    inside = find_containing_concession(lat, lng, concessions)
    nearest = None
    for d in detections:
        if "illegal" not in d.status:
            continue
        km = haversine_km(lat, lng, d.latitude, d.longitude)
        if km <= NEAR_ILLEGAL_KM and (nearest is None or km < nearest["km"]):
            nearest = {"km": round(km, 2), "status": d.status, "region": d.region,
                       "lat": d.latitude, "lng": d.longitude, "id": str(d.id)}
    hot = None
    for h in hotspots:
        if h.severity != "high":
            continue
        km = haversine_km(lat, lng, h.latitude, h.longitude)
        if km <= NEAR_HOTSPOT_KM and (hot is None or km < hot["km"]):
            hot = {"km": round(km, 2), "title": h.title, "lat": h.latitude, "lng": h.longitude}

    base = {"origin": {"lat": lat, "lng": lng, "basis": basis},
            "concession": inside.code if inside else None,
            "nearest_illegal": nearest, "nearest_hotspot": hot}
    if nearest and nearest["status"] == "confirmed_illegal":
        return {**base, "status": "illegal",
                "message": f"Origin is {nearest['km']} km from a CONFIRMED illegal-mining site."}
    if inside is None:
        return {**base, "status": "outside",
                "message": "Origin lies outside every licensed concession — possible illegal source."}
    if batch.concession_id and inside.id != batch.concession_id:
        return {**base, "status": "suspect",
                "message": f"Origin falls in concession {inside.code}, not the one declared for this lot."}
    if nearest or hot:
        what = (f"a suspected illegal site {nearest['km']} km away" if nearest
                else f"high-severity hotspot '{hot['title']}' {hot['km']} km away")
        return {**base, "status": "suspect", "message": f"Origin is inside {inside.code} but near {what}."}
    return {**base, "status": "verified",
            "message": f"Origin verified inside licensed concession {inside.code}."}


def lots_near(lat, lng, km=3.0, batches=None):
    """Gold lots whose recorded origin is within `km` of a point (e.g. an illegal site)."""
    from production.models import GoldBatch
    out = []
    qs = batches if batches is not None else GoldBatch.objects.select_related("current_owner")
    for b in qs:
        o = lot_origin(b)
        if not o:
            continue
        d = haversine_km(lat, lng, o[0], o[1])
        if d <= km:
            out.append({"batch_code": b.batch_code, "km": round(d, 2),
                        "gross_weight_g": str(b.gross_weight_g),
                        "owner": b.current_owner.username if b.current_owner else None,
                        "status": b.get_status_display()})
    return sorted(out, key=lambda x: x["km"])
