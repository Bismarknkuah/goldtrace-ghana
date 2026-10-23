"""Ghana-specific geography: national bounds and the 16 regional capitals.

Used to keep every coordinate in the system realistic (inside Ghana), to place
records that only carry a region name, and to label raw GPS points with the
region they most likely fall in.
"""
from __future__ import annotations

from rest_framework.exceptions import ValidationError

from .services import haversine_km

# Mainland Ghana bounding box (with a small coastal/border margin).
LAT_MIN, LAT_MAX = 4.5, 11.2
LNG_MIN, LNG_MAX = -3.3, 1.3
CENTER = (7.95, -1.03)

# Regional capitals (lat, lng) for all 16 regions.
REGIONS: dict[str, tuple[float, float]] = {
    "Greater Accra": (5.6037, -0.1870),
    "Ashanti": (6.6885, -1.6244),
    "Western": (4.9340, -1.7137),
    "Western North": (6.2077, -2.4859),
    "Central": (5.1053, -1.2466),
    "Eastern": (6.0941, -0.2591),
    "Volta": (6.6008, 0.4713),
    "Oti": (8.0697, 0.1794),
    "Northern": (9.4008, -0.8393),
    "Savannah": (9.0833, -1.8167),
    "North East": (10.5274, -0.3698),
    "Upper East": (10.7856, -0.8514),
    "Upper West": (10.0601, -2.5099),
    "Bono": (7.3349, -2.3123),
    "Bono East": (7.5832, -1.9381),
    "Ahafo": (6.8036, -2.5172),
}


def in_ghana(lat, lng) -> bool:
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX


def validate_point(lat, lng, *, field="location"):
    """Raise a clear API error when a coordinate is missing half or lies outside Ghana."""
    if lat in (None, "") and lng in (None, ""):
        return
    if lat in (None, "") or lng in (None, ""):
        raise ValidationError({field: "Provide both latitude and longitude."})
    if not in_ghana(lat, lng):
        raise ValidationError({field: (
            f"{float(lat):.5f}, {float(lng):.5f} is outside Ghana. Latitude must be between "
            f"{LAT_MIN} and {LAT_MAX}, longitude between {LNG_MIN} and {LNG_MAX} "
            "(Ghana longitudes are mostly negative, e.g. -1.67)."
        )})


def normalise_region(name: str | None) -> str | None:
    if not name:
        return None
    key = name.strip().lower().replace("region", "").strip()
    for r in REGIONS:
        if r.lower() == key:
            return r
    return None


def region_centroid(name: str | None):
    r = normalise_region(name)
    return REGIONS[r] if r else None


def nearest_region(lat, lng) -> str | None:
    """Approximate region for a point: the nearest regional capital."""
    if not in_ghana(lat, lng):
        return None
    return min(REGIONS, key=lambda r: haversine_km(float(lat), float(lng), *REGIONS[r]))
