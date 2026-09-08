from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import REGULATOR_ROLES
from gis.services import haversine_km

from .models import Courier, CourierStatus, DeliveryRequest, DeliveryStatus
from .serializers import (
    CandidateSerializer,
    CourierSerializer,
    DeliveryCreateSerializer,
    DeliveryRequestSerializer,
)
from .services import estimate_eta_minutes, estimate_price, rank_nearby_couriers


def _is_regulator(user):
    return user.is_superuser or user.role in {r.value for r in REGULATOR_ROLES}


@extend_schema(tags=["logistics"])
class CourierViewSet(viewsets.ModelViewSet):
    serializer_class = CourierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Courier.objects.select_related("user")
        return qs if _is_regulator(self.request.user) else qs.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def me(self, request):
        courier = Courier.objects.filter(user=request.user).select_related("user").first()
        if not courier:
            return Response({"detail": "No courier profile."}, status=404)
        return Response(self.get_serializer(courier).data)

    @action(detail=False, methods=["post"])
    def go_online(self, request):
        """Set availability and current position (rider/driver 'go online')."""
        courier = get_object_or_404(Courier, user=request.user)
        courier.status = request.data.get("status", CourierStatus.AVAILABLE)
        if "lat" in request.data and "lng" in request.data:
            courier.current_lat = float(request.data["lat"])
            courier.current_lng = float(request.data["lng"])
        courier.last_seen = timezone.now()
        courier.save()
        return Response(self.get_serializer(courier).data)

    @action(detail=False, methods=["post"])
    def location(self, request):
        courier = get_object_or_404(Courier, user=request.user)
        courier.current_lat = float(request.data["lat"])
        courier.current_lng = float(request.data["lng"])
        courier.last_seen = timezone.now()
        courier.save(update_fields=["current_lat", "current_lng", "last_seen"])
        return Response(self.get_serializer(courier).data)


@extend_schema(tags=["logistics"])
class DeliveryRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return DeliveryCreateSerializer if self.action == "create" else DeliveryRequestSerializer

    def get_queryset(self):
        user = self.request.user
        qs = DeliveryRequest.objects.select_related("batch", "courier__user", "seller", "buyer")
        if _is_regulator(user):
            return qs
        courier = getattr(user, "courier_profile", None)
        if courier:
            return qs.filter(courier=courier)
        return qs.filter(seller=user) | qs.filter(buyer=user)

    def perform_create(self, serializer):
        data = serializer.validated_data
        batch = data["batch"]
        # Pickup defaults to the batch concession centroid if not supplied.
        pickup_lat = data.get("pickup_lat")
        pickup_lng = data.get("pickup_lng")
        if pickup_lat is None and batch.concession and batch.concession.centroid_lat:
            pickup_lat = batch.concession.centroid_lat
            pickup_lng = batch.concession.centroid_lng
        if pickup_lat is None:
            raise ValidationError("pickup_lat/pickup_lng required (no concession centroid on batch).")

        buyer = data.get("buyer") or batch.current_owner
        if buyer is None:
            raise ValidationError("buyer required (batch has no current owner).")

        distance = haversine_km(pickup_lat, pickup_lng, data["dropoff_lat"], data["dropoff_lng"])
        price = estimate_price(data["courier_type"], distance, data.get("parcel_weight_kg", 1.0))
        eta = estimate_eta_minutes(data["courier_type"], distance)

        serializer.save(
            requested_by=self.request.user, seller=self.request.user, buyer=buyer,
            pickup_lat=pickup_lat, pickup_lng=pickup_lng,
            distance_km=round(distance, 2), price_ghs=price, eta_minutes=eta,
            status=DeliveryStatus.SEARCHING,
        )

    # ---- AI matching + assignment ---------------------------------------- #
    @extend_schema(responses=CandidateSerializer(many=True))
    @action(detail=True, methods=["get"])
    def candidates(self, request, pk=None):
        """AI proximity match: nearest available couriers of the requested type."""
        delivery = self.get_object()
        pool = Courier.objects.filter(
            courier_type=delivery.courier_type, status=CourierStatus.AVAILABLE, is_bonded=True)
        ranked = rank_nearby_couriers(
            delivery.pickup_lat, delivery.pickup_lng, delivery.courier_type,
            delivery.parcel_weight_kg, pool)
        out = [{
            "courier_id": str(c.id), "username": c.user.username, "company": c.company,
            "courier_type": c.courier_type, "plate_number": c.plate_number,
            "phone": c.phone, "rating": c.rating, "distance_km": dist,
            "eta_minutes": estimate_eta_minutes(delivery.courier_type, dist),
            "price_ghs": delivery.price_ghs,
        } for c, dist in ranked]
        return Response(CandidateSerializer(out, many=True).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Requester picks a courier; the job is offered to them."""
        delivery = self.get_object()
        courier = get_object_or_404(Courier, id=request.data.get("courier_id"))
        delivery.courier = courier
        delivery.status = DeliveryStatus.OFFERED
        delivery.save(update_fields=["courier", "status"])
        return Response(DeliveryRequestSerializer(delivery).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        delivery = self.get_object()
        courier = getattr(request.user, "courier_profile", None)
        if not courier or delivery.courier_id != courier.id:
            raise PermissionDenied("This job was not offered to you.")
        delivery.status = DeliveryStatus.ACCEPTED
        delivery.courier_lat = courier.current_lat
        delivery.courier_lng = courier.current_lng
        delivery.courier_updated_at = timezone.now()
        delivery.save(update_fields=["status", "courier_lat", "courier_lng", "courier_updated_at"])
        courier.status = CourierStatus.ON_DELIVERY
        courier.save(update_fields=["status"])
        return Response(DeliveryRequestSerializer(delivery).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        delivery = self.get_object()
        delivery.courier = None
        delivery.status = DeliveryStatus.SEARCHING
        delivery.save(update_fields=["courier", "status"])
        return Response(DeliveryRequestSerializer(delivery).data)

    @action(detail=True, methods=["post"])
    def handover(self, request, pk=None):
        """Seller applies the tamper-evident seal and hands the parcel to the carrier.

        The seal number is written into the batch's custody chain, so the
        transport leg is itself tamper-evident and auditable.
        """
        from production.models import CustodyEventType
        from production.services import append_custody_event

        delivery = self.get_object()
        delivery.seal_number = request.data.get("seal_number", delivery.seal_number)
        delivery.escort_required = bool(request.data.get("escort_required", delivery.escort_required))
        delivery.handed_over = True
        delivery.handed_over_at = timezone.now()
        delivery.status = DeliveryStatus.PICKED_UP
        delivery.save(update_fields=["seal_number", "escort_required", "handed_over",
                                     "handed_over_at", "status"])
        carrier = delivery.courier.company if delivery.courier else "bonded carrier"
        append_custody_event(
            delivery.batch, CustodyEventType.TRANSFER, actor=request.user,
            from_party=str(delivery.seller), to_party=carrier,
            metadata={"leg": "secure_transport", "seal_number": delivery.seal_number,
                      "escort": delivery.escort_required})
        return Response(DeliveryRequestSerializer(delivery).data)

    @action(detail=True, methods=["get", "post"])
    def track(self, request, pk=None):
        """POST: courier shares position. GET: current tracking payload for the map."""
        delivery = self.get_object()
        if request.method == "POST":
            delivery.courier_lat = float(request.data["lat"])
            delivery.courier_lng = float(request.data["lng"])
            delivery.courier_updated_at = timezone.now()
            if delivery.status in (DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP):
                delivery.status = DeliveryStatus.IN_TRANSIT
            delivery.save(update_fields=["courier_lat", "courier_lng", "courier_updated_at", "status"])
        return Response({
            "status": delivery.status,
            "pickup": {"lat": delivery.pickup_lat, "lng": delivery.pickup_lng},
            "dropoff": {"lat": delivery.dropoff_lat, "lng": delivery.dropoff_lng},
            "courier": {"lat": delivery.courier_lat, "lng": delivery.courier_lng,
                        "updated_at": delivery.courier_updated_at},
        })

    @action(detail=True, methods=["post"], url_path="confirm-receipt")
    def confirm_receipt(self, request, pk=None):
        """Buyer ticks that the parcel was received."""
        delivery = self.get_object()
        delivery.received_by_buyer = True
        delivery.received_at = timezone.now()
        delivery.status = DeliveryStatus.DELIVERED
        delivery.save(update_fields=["received_by_buyer", "received_at", "status"])
        if delivery.courier:
            delivery.courier.status = CourierStatus.AVAILABLE
            delivery.courier.save(update_fields=["status"])
        return Response(DeliveryRequestSerializer(delivery).data)
