"""Nearest-carrier matching + institutional haulage pricing for secure transport.

Haulage estimate (GHS): base 50 + distance-rate + load-rate.
  Motorbike unit: 6 GHS/km.  Vehicle unit: 12 GHS/km.  Load: 2 GHS/kg.
Matching ranks bonded/approved carriers on duty by distance from the store.
"""
from decimal import ROUND_HALF_UP, Decimal

from gis.services import haversine_km

BASE_FEE = Decimal("50")
BIKE_RATE = Decimal("6")
VEHICLE_RATE = Decimal("12")
LOAD_RATE = Decimal("2")  # per kg

RIDER_SPEED_KMH = 30
DRIVER_SPEED_KMH = 25
DEFAULT_RADIUS_KM = 15


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def estimate_price(courier_type: str, distance_km: float, weight_kg: float = 0.0) -> Decimal:
    rate = BIKE_RATE if courier_type == "rider" else VEHICLE_RATE
    d = Decimal(str(round(distance_km, 3)))
    price = BASE_FEE + d * rate + Decimal(str(weight_kg)) * LOAD_RATE
    return _money(price)


def estimate_eta_minutes(courier_type: str, distance_km: float) -> int:
    speed = RIDER_SPEED_KMH if courier_type == "rider" else DRIVER_SPEED_KMH
    return int(round(distance_km / speed * 60)) if distance_km else 0


def rank_nearby_couriers(pickup_lat, pickup_lng, courier_type, weight_kg,
                         couriers, radius_km=DEFAULT_RADIUS_KM, limit=5):
    """Return [(courier, distance_km)] — nearest eligible bonded carriers first."""
    ranked = []
    for c in couriers:
        if c.current_lat is None or c.current_lng is None:
            continue
        if c.max_weight_kg < weight_kg:
            continue
        dist = haversine_km(pickup_lat, pickup_lng, c.current_lat, c.current_lng)
        if dist <= radius_km:
            ranked.append((c, round(dist, 2)))
    ranked.sort(key=lambda x: x[1])
    return ranked[:limit]
