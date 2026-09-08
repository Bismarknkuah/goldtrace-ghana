"""Pure-Python geospatial helpers (no GDAL/Shapely dependency).

MongoDB 2dsphere handles indexed queries in production; these functions provide
deterministic point-in-polygon and feature shaping for the API and offline tests.
"""
import math


def _point_in_ring(lng, lat, ring) -> bool:
    """Ray-casting test: is (lng, lat) inside a single GeoJSON linear ring?"""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersects = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_in_polygon(lng, lat, polygon) -> bool:
    """polygon = GeoJSON Polygon coordinates: [outer_ring, hole1, ...]."""
    if not polygon:
        return False
    if not _point_in_ring(lng, lat, polygon[0]):
        return False
    for hole in polygon[1:]:  # inside a hole means outside the polygon
        if _point_in_ring(lng, lat, hole):
            return False
    return True


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def find_containing_concession(lat, lng, concessions):
    """Return the first concession whose boundary contains the point, else None."""
    for c in concessions:
        coords = (c.boundary or {}).get("coordinates")
        if coords and point_in_polygon(lng, lat, coords):
            return c
    return None


def concession_feature(c) -> dict:
    return {
        "type": "Feature",
        "geometry": c.boundary or None,
        "properties": {
            "id": str(c.id), "code": c.code, "name": c.name,
            "region": c.region, "area_hectares": c.area_hectares,
            "is_active": c.is_active,
        },
    }


def hotspot_feature(h) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [h.longitude, h.latitude]},
        "properties": {
            "id": str(h.id), "title": h.title, "severity": h.severity,
            "status": h.status, "region": h.region, "source": h.source,
        },
    }
