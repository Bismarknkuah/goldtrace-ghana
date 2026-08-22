from django.contrib import admin

from .models import Courier, DeliveryRequest


@admin.register(Courier)
class CourierAdmin(admin.ModelAdmin):
    list_display = ("user", "courier_type", "status", "plate_number", "max_weight_kg", "rating")
    list_filter = ("courier_type", "status")


@admin.register(DeliveryRequest)
class DeliveryRequestAdmin(admin.ModelAdmin):
    list_display = ("batch", "courier_type", "status", "courier", "distance_km", "price_ghs", "created_at")
    list_filter = ("status", "courier_type")
    search_fields = ("batch__batch_code",)
