from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from rest_framework.routers import DefaultRouter

from .views import (AdminUserViewSet, ChangePasswordView, MeView, OperatorLocationsView,
                    RegisterView, RoleTokenObtainPairView)

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("token/", RoleTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("operators/", OperatorLocationsView.as_view(), name="operators"),
]

router = DefaultRouter()
router.register("admin/users", AdminUserViewSet, basename="admin-user")
urlpatterns += router.urls
