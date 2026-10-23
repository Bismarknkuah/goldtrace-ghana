from rest_framework.permissions import BasePermission, SAFE_METHODS

from accounts.models import REGULATOR_ROLES, Role


class MinerAccessPolicy(BasePermission):
    """Regulators: full access. Miners: their own records. Others: read-only."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or user.role in {r.value for r in REGULATOR_ROLES}:
            return True
        owner = getattr(obj, "user", None) or getattr(getattr(obj, "miner", None), "user", None)
        if owner == user:
            return True
        return request.method in SAFE_METHODS
