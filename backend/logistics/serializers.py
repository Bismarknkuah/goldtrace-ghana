from rest_framework import serializers

from .models import Courier, DeliveryRequest


class CourierSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    courier_type_display = serializers.CharField(source="get_courier_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Courier
        fields = (
            "id", "user", "username", "courier_type", "courier_type_display",
            "status", "status_display", "plate_number", "phone", "max_weight_kg",
            "is_bonded", "company", "registration_no",
            "current_lat", "current_lng", "rating", "last_seen",
        )
        read_only_fields = ("user", "status", "rating", "last_seen")


class DeliveryRequestSerializer(serializers.ModelSerializer):
    batch_code = serializers.CharField(source="batch.batch_code", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    courier_name = serializers.CharField(source="courier.user.username", read_only=True, default=None)
    courier_phone = serializers.CharField(source="courier.phone", read_only=True, default="")
    courier_company = serializers.CharField(source="courier.company", read_only=True, default="")
    seller_name = serializers.CharField(source="seller.username", read_only=True)
    buyer_name = serializers.CharField(source="buyer.username", read_only=True)

    class Meta:
        model = DeliveryRequest
        fields = (
            "id", "batch", "batch_code", "requested_by", "seller", "seller_name",
            "buyer", "buyer_name", "courier_type", "parcel_weight_kg", "parcel_note",
            "seal_number", "escort_required", "escort_ref",
            "pickup_lat", "pickup_lng", "pickup_address",
            "dropoff_lat", "dropoff_lng", "dropoff_address",
            "distance_km", "price_ghs", "eta_minutes", "status", "status_display",
            "courier", "courier_name", "courier_phone", "courier_company",
            "courier_lat", "courier_lng", "courier_updated_at",
            "handed_over", "handed_over_at", "received_by_buyer", "received_at",
            "created_at",
        )
        read_only_fields = fields


class DeliveryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryRequest
        fields = (
            "batch", "buyer", "courier_type", "parcel_weight_kg", "parcel_note",
            "dropoff_lat", "dropoff_lng", "dropoff_address",
            "pickup_lat", "pickup_lng", "pickup_address",
        )
        extra_kwargs = {
            "pickup_lat": {"required": False}, "pickup_lng": {"required": False},
            "pickup_address": {"required": False}, "parcel_note": {"required": False},
            "dropoff_address": {"required": False},
            "buyer": {"required": False},
        }


class CandidateSerializer(serializers.Serializer):
    courier_id = serializers.CharField()
    username = serializers.CharField()
    company = serializers.CharField()
    courier_type = serializers.CharField()
    plate_number = serializers.CharField()
    phone = serializers.CharField()
    rating = serializers.FloatField()
    distance_km = serializers.FloatField()
    eta_minutes = serializers.IntegerField()
    price_ghs = serializers.DecimalField(max_digits=10, decimal_places=2)
