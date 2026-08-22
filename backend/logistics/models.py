"""Logistics & delivery: couriers (riders/drivers), delivery requests, tracking."""
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from production.models import GoldBatch


class CourierType(models.TextChoices):
    RIDER = "rider", "Rider (motorbike)"
    DRIVER = "driver", "Driver (vehicle)"


class CourierStatus(models.TextChoices):
    OFFLINE = "offline", "Offline"
    AVAILABLE = "available", "Available"
    ON_DELIVERY = "on_delivery", "On delivery"


class Courier(TimeStampedModel):
    """A rider or driver who accepts delivery jobs."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="courier_profile")
    courier_type = models.CharField(max_length=8, choices=CourierType.choices, db_index=True)
    status = models.CharField(
        max_length=12, choices=CourierStatus.choices, default=CourierStatus.OFFLINE, db_index=True)
    plate_number = models.CharField(max_length=20, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    max_weight_kg = models.FloatField(default=20.0)
    is_bonded = models.BooleanField(default=True)      # approved / bonded carrier
    company = models.CharField(max_length=120, blank=True)
    registration_no = models.CharField(max_length=40, blank=True)
    current_lat = models.FloatField(null=True, blank=True)
    current_lng = models.FloatField(null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    rating = models.FloatField(default=5.0)

    def __str__(self):
        return f"{self.user.username} · {self.get_courier_type_display()}"


class DeliveryStatus(models.TextChoices):
    SEARCHING = "searching", "Searching for courier"
    OFFERED = "offered", "Offered to courier"
    ACCEPTED = "accepted", "Courier accepted"
    PICKED_UP = "picked_up", "Picked up"
    IN_TRANSIT = "in_transit", "In transit"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class DeliveryRequest(TimeStampedModel):
    """A request to move a gold parcel from the seller's store to the buyer."""

    batch = models.ForeignKey(GoldBatch, on_delete=models.PROTECT, related_name="deliveries")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="delivery_requests")
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="deliveries_as_seller")
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="deliveries_as_buyer")

    courier_type = models.CharField(max_length=8, choices=CourierType.choices)
    parcel_weight_kg = models.FloatField(default=1.0)
    parcel_note = models.CharField(max_length=160, blank=True)
    seal_number = models.CharField(max_length=40, blank=True)     # tamper-evident seal
    escort_required = models.BooleanField(default=False)          # security-agency escort
    escort_ref = models.CharField(max_length=60, blank=True)

    pickup_lat = models.FloatField()
    pickup_lng = models.FloatField()
    pickup_address = models.CharField(max_length=200, blank=True)
    dropoff_lat = models.FloatField()
    dropoff_lng = models.FloatField()
    dropoff_address = models.CharField(max_length=200, blank=True)

    distance_km = models.FloatField(default=0.0)
    price_ghs = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    eta_minutes = models.IntegerField(default=0)

    status = models.CharField(
        max_length=12, choices=DeliveryStatus.choices, default=DeliveryStatus.SEARCHING, db_index=True)
    courier = models.ForeignKey(
        Courier, null=True, blank=True, on_delete=models.SET_NULL, related_name="deliveries")

    # Live tracking — latest courier position while en route.
    courier_lat = models.FloatField(null=True, blank=True)
    courier_lng = models.FloatField(null=True, blank=True)
    courier_updated_at = models.DateTimeField(null=True, blank=True)

    handed_over = models.BooleanField(default=False)          # seller -> courier
    handed_over_at = models.DateTimeField(null=True, blank=True)
    received_by_buyer = models.BooleanField(default=False)    # buyer confirms receipt
    received_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Delivery {self.batch.batch_code} [{self.status}]"
