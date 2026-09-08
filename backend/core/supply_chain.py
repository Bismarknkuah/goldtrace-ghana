"""GoldBod supply-chain flow: who may sell to whom, and at what stage.

Miner -> Tier 1 -> Tier 2 -> Aggregator -> GoldBod -> Off-taker / Export.
Transfers outside this flow are recorded and flagged 'irregular' so they surface
as AML risk rather than being silently allowed.
"""
from accounts.models import Role

FLOW = {
    Role.MINER.value: {
        Role.TIER1_BUYER.value: "miner_to_tier1",
        Role.TIER2_BUYER.value: "miner_to_tier2",
        Role.AGGREGATOR.value: "miner_to_aggregator",
    },
    Role.TIER1_BUYER.value: {
        Role.TIER2_BUYER.value: "tier1_to_tier2",
        Role.AGGREGATOR.value: "tier1_to_aggregator",
    },
    Role.TIER2_BUYER.value: {
        Role.AGGREGATOR.value: "tier2_to_aggregator",
    },
    Role.AGGREGATOR.value: {
        Role.GOLDBOD_OFFICER.value: "aggregator_to_goldbod",
    },
    Role.GOLDBOD_OFFICER.value: {
        Role.INTERNATIONAL_BUYER.value: "goldbod_to_offtaker",
        Role.EXPORTER.value: "goldbod_to_export",
    },
}

STAGE_LABELS = {
    "miner_to_tier1": "Miner -> Tier 1", "miner_to_tier2": "Miner -> Tier 2",
    "miner_to_aggregator": "Miner -> Aggregator", "tier1_to_tier2": "Tier 1 -> Tier 2",
    "tier1_to_aggregator": "Tier 1 -> Aggregator", "tier2_to_aggregator": "Tier 2 -> Aggregator",
    "aggregator_to_goldbod": "Aggregator -> GoldBod", "goldbod_to_offtaker": "GoldBod -> Off-taker",
    "goldbod_to_export": "GoldBod -> Export", "other": "Irregular / other",
}


def resolve_stage(seller_role: str, buyer_role: str):
    """Return (stage, is_regular). Irregular = not part of the GoldBod flow."""
    stage = FLOW.get(seller_role, {}).get(buyer_role)
    if stage:
        return stage, True
    return "other", False
