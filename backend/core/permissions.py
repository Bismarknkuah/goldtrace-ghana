"""Reusable role-based DRF permissions."""
from rest_framework.permissions import BasePermission


class HasAnyRole(BasePermission):
    """Grant access if the user holds one of ``required_roles`` on the view."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        required = getattr(view, "required_roles", None)
        return True if not required else user.role in required


class IsVerified(BasePermission):
    message = "Account must complete Ghana Card / identity verification."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_verified)
