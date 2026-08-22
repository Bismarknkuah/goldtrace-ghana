"""Central per-role data scoping.

One place decides who can see which gold. Regulators and enforcement see the
whole national picture; a mining company's staff see only their group's gold; a
miner sees only their own; traders see what they hold or created; couriers see
only batches on their own delivery jobs. Everyone else sees nothing by default.
"""
from django.db.models import Q

from accounts.models import ENFORCEMENT_ROLES, REGULATOR_ROLES, Role

FULL_ROLES = {r.value for r in REGULATOR_ROLES} | {r.value for r in ENFORCEMENT_ROLES}
OWNER_ROLES = {Role.EXPORTER.value, Role.BUYING_AGENT.value,
               Role.REFINERY_OPERATOR.value, Role.INTERNATIONAL_BUYER.value}
# Buyers/aggregators also see the tradeable pool so they can find gold to buy.
TRADER_ROLES = {Role.TIER1_BUYER.value, Role.TIER2_BUYER.value, Role.AGGREGATOR.value,
                Role.BUYING_AGENT.value, Role.EXPORTER.value,
                Role.REFINERY_OPERATOR.value, Role.INTERNATIONAL_BUYER.value}
TRADEABLE_STATUSES = ["created", "assayed", "in_transit"]


def has_full_visibility(user) -> bool:
    return bool(user.is_superuser or user.role in FULL_ROLES)


# --- Pure predicate (unit-testable, no DB) ---------------------------------- #
def can_view_batch(*, role, is_superuser, user_id, user_company_id,
                   miner_user_id, miner_company_id, current_owner_id, created_by_id,
                   status=None) -> bool:
    if is_superuser or role in FULL_ROLES:
        return True
    if role == Role.MINING_COMPANY.value:
        return user_company_id is not None and miner_company_id == user_company_id
    if role == Role.MINER.value:
        return miner_user_id == user_id
    if role in TRADER_ROLES:
        return (current_owner_id == user_id or created_by_id == user_id
                or status in TRADEABLE_STATUSES)
    return False


# --- Queryset filters (mirror the predicate) -------------------------------- #
def scope_batches(qs, user):
    if has_full_visibility(user):
        return qs
    r = user.role
    if r == Role.MINING_COMPANY.value:
        return qs.filter(miner__company_id=user.company_id) if user.company_id else qs.none()
    if r == Role.MINER.value:
        return qs.filter(miner__user=user)
    if r in TRADER_ROLES:
        # Own holdings + anything currently available in the supply chain to buy.
        return qs.filter(
            Q(current_owner=user) | Q(created_by=user) | Q(status__in=TRADEABLE_STATUSES)
        ).distinct()
    if r in (Role.RIDER.value, Role.DRIVER.value):
        return qs.filter(deliveries__courier__user=user).distinct()
    return qs.none()


def scope_miners(qs, user):
    if has_full_visibility(user):
        return qs
    if user.role == Role.MINING_COMPANY.value:
        return qs.filter(company_id=user.company_id) if user.company_id else qs.none()
    if user.role == Role.MINER.value:
        return qs.filter(user=user)
    return qs.none()


def scope_concessions(qs, user):
    if has_full_visibility(user):
        return qs
    if user.role == Role.MINING_COMPANY.value:
        return qs.filter(miner__company_id=user.company_id) if user.company_id else qs.none()
    if user.role == Role.MINER.value:
        return qs.filter(miner__user=user)
    return qs.none()


def scope_companies(qs, user):
    if has_full_visibility(user):
        return qs
    if user.role in (Role.MINING_COMPANY.value, Role.MINER.value) and user.company_id:
        return qs.filter(id=user.company_id)
    return qs.none()
