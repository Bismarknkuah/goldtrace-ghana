from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Role
from .serializers import (
    AdminUserCreateSerializer,
    AdminUserSerializer,
    ChangePasswordSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)

User = get_user_model()


class RoleTokenObtainPairView(TokenObtainPairView):
    serializer_class = RoleTokenObtainPairSerializer
    throttle_scope = "auth"


@extend_schema(tags=["auth"])
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"


@extend_schema(tags=["auth"])
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_superuser or u.role == Role.SUPER_ADMIN))


@extend_schema(tags=["auth"])
class AdminUserViewSet(viewsets.ModelViewSet):
    """Super Admin: create users, assign roles, activate/deactivate."""
    queryset = User.objects.all().order_by("username")
    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        return AdminUserCreateSerializer if self.action == "create" else AdminUserSerializer


@extend_schema(tags=["auth"])
class ChangePasswordView(generics.GenericAPIView):
    """Any signed-in user can change their own password (e.g. after being
    issued a temporary password by an administrator)."""
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(s.validated_data["old_password"]):
            return Response({"old_password": "Your current password is incorrect."},
                            status=status.HTTP_400_BAD_REQUEST)
        user.set_password(s.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password changed successfully."})


@extend_schema(tags=["auth"])
class OperatorLocationsView(APIView):
    """Map pins for every operator that has coordinates. Oversight roles only."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.scoping import has_full_visibility
        if not has_full_visibility(request.user):
            return Response({"detail": "Oversight access required."}, status=403)
        qs = (User.objects.exclude(latitude=None).exclude(longitude=None)
              .values("username", "role", "region", "district", "latitude", "longitude"))
        out = []
        for u in qs:
            u["role_display"] = dict(Role.choices).get(u["role"], u["role"])
            out.append(u)
        return Response(out)
