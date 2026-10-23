"""GoldBod trading rulebook — who may sell gold to whom, and what they must hold.

Modelled on the Ghana Gold Board Act, 2025 (Act 1140) structure and GoldBod's
published licensing framework:

  Licensed miner -> Tier 1 buyer -> Tier 2 buyer -> Aggregator -> GoldBod
  GoldBod -> Refinery -> GoldBod / Exporter -> International off-taker

Key principles enforced here:
  * GoldBod is the central buyer, assayer, valuer and exporter of gold.
  * Tier 1 buys only from licensed miners and sells on to Tier 2 / aggregators.
  * Tier 2 buys from miners or Tier 1 and sells on to aggregators.
  * Aggregators buy from miners, Tier 1 and Tier 2 and supply GoldBod.
  * Buying agents buy on GoldBod's behalf and hand gold to GoldBod.
  * Foreign buyers may NOT trade locally — they only off-take from GoldBod /
    its licensed exporters.
  * Every licensed trader must hold a valid GoldBod licence for its tier, and
    miners a valid mining licence.
  * Prices are referenced to the Bank of Ghana reference rate.

Any sale outside this rulebook is refused. Every rule carries a plain-language
reason so the system can explain *why* a trade is or is not allowed.
"""
from accounts.models import Role

R = Role

# seller role -> {buyer role: (stage code, plain-language basis)}
FLOW = {
    R.MINER.value: {
        R.TIER1_BUYER.value: ("miner_to_tier1", "Licensed miners sell to licensed Tier 1 buyers."),
        R.TIER2_BUYER.value: ("miner_to_tier2", "Licensed miners may sell directly to Tier 2 buyers."),
        R.AGGREGATOR.value: ("miner_to_aggregator", "Aggregators may buy directly from licensed miners."),
        R.BUYING_AGENT.value: ("miner_to_agent", "GoldBod buying agents purchase from miners on GoldBod's behalf."),
        R.GOLDBOD_OFFICER.value: ("miner_to_goldbod", "Miners may sell directly to GoldBod at its buying centres."),
    },
    R.MINING_COMPANY.value: {
        R.TIER2_BUYER.value: ("company_to_tier2", "Licensed mining companies may sell to Tier 2 buyers."),
        R.AGGREGATOR.value: ("company_to_aggregator", "Licensed mining companies may sell to aggregators."),
        R.BUYING_AGENT.value: ("company_to_agent", "GoldBod buying agents purchase on GoldBod's behalf."),
        R.GOLDBOD_OFFICER.value: ("company_to_goldbod", "Mining companies may sell directly to GoldBod."),
    },
    R.TIER1_BUYER.value: {
        R.TIER2_BUYER.value: ("tier1_to_tier2", "Tier 1 buyers sell on to licensed Tier 2 buyers."),
        R.AGGREGATOR.value: ("tier1_to_aggregator", "Aggregators may buy from Tier 1 buyers."),
        R.BUYING_AGENT.value: ("tier1_to_agent", "GoldBod buying agents may buy from Tier 1 buyers."),
    },
    R.TIER2_BUYER.value: {
        R.AGGREGATOR.value: ("tier2_to_aggregator", "Tier 2 buyers sell on to licensed aggregators."),
        R.BUYING_AGENT.value: ("tier2_to_agent", "GoldBod buying agents may buy from Tier 2 buyers."),
    },
    R.AGGREGATOR.value: {
        R.GOLDBOD_OFFICER.value: ("aggregator_to_goldbod", "Aggregators supply the gold they collect to GoldBod."),
    },
    R.BUYING_AGENT.value: {
        R.GOLDBOD_OFFICER.value: ("agent_to_goldbod", "Buying agents hand gold bought on GoldBod's behalf to GoldBod."),
    },
    R.GOLDBOD_OFFICER.value: {
        R.REFINERY_OPERATOR.value: ("goldbod_to_refinery", "GoldBod sends gold to licensed refineries for refining."),
        R.EXPORTER.value: ("goldbod_to_exporter", "GoldBod releases gold to its licensed exporters."),
        R.INTERNATIONAL_BUYER.value: ("goldbod_to_offtaker", "Foreign off-takers buy only from GoldBod."),
    },
    R.REFINERY_OPERATOR.value: {
        R.GOLDBOD_OFFICER.value: ("refinery_to_goldbod", "Refined gold returns to GoldBod."),
        R.EXPORTER.value: ("refinery_to_exporter", "Refined gold may be released to a licensed exporter."),
    },
    R.EXPORTER.value: {
        R.INTERNATIONAL_BUYER.value: ("exporter_to_offtaker", "Licensed exporters ship to approved international off-takers."),
    },
}

# Licence a party must hold, in that role, to trade at all.
REQUIRED_LICENCE = {
    R.TIER1_BUYER.value: ["tier1_buyer"],
    R.TIER2_BUYER.value: ["tier2_buyer"],
    R.AGGREGATOR.value: ["aggregator", "self_financing_aggregator"],
    R.EXPORTER.value: ["exporter"],
    R.REFINERY_OPERATOR.value: ["refiner"],
}
MINING_LICENCE_ROLES = {R.MINER.value, R.MINING_COMPANY.value}
# Roles that act as GoldBod itself (no trading licence needed).
GOLDBOD_ROLES = {R.GOLDBOD_OFFICER.value, R.BUYING_AGENT.value}
TRADING_ROLES = set(FLOW) | {b for m in FLOW.values() for b in m}

ROLE_LABEL = {v: label for v, label in Role.choices}

STAGE_LABELS = {stage: f"{ROLE_LABEL.get(s, s)} → {ROLE_LABEL.get(b, b)}"
                for s, buyers in FLOW.items() for b, (stage, _) in buyers.items()}
STAGE_LABELS["other"] = "Not permitted under GoldBod rules"


def resolve_stage(seller_role: str, buyer_role: str):
    """Return (stage, is_permitted)."""
    rule = FLOW.get(seller_role, {}).get(buyer_role)
    return (rule[0], True) if rule else ("other", False)


def _a(word: str) -> str:
    return ("an " if word[:1].lower() in "aeiou" else "a ") + word


def _A(word: str) -> str:
    x = _a(word)
    return x[0].upper() + x[1:]


FLOW_ORDER = [R.MINER.value, R.MINING_COMPANY.value, R.TIER1_BUYER.value, R.TIER2_BUYER.value,
              R.AGGREGATOR.value, R.BUYING_AGENT.value, R.GOLDBOD_OFFICER.value,
              R.REFINERY_OPERATOR.value, R.EXPORTER.value, R.INTERNATIONAL_BUYER.value]


def explain(seller_role: str, buyer_role: str) -> str:
    """Plain-language reason a sale is or is not allowed."""
    rule = FLOW.get(seller_role, {}).get(buyer_role)
    if rule:
        return rule[1]
    s, b = ROLE_LABEL.get(seller_role, seller_role), ROLE_LABEL.get(buyer_role, buyer_role)
    if buyer_role == R.INTERNATIONAL_BUYER.value:
        return (f"International buyers may not buy gold locally from {_a(s)}. Foreign off-takers "
                "buy only from GoldBod or its licensed exporters.")
    allowed = [ROLE_LABEL.get(x, x) for x in FLOW.get(seller_role, {})]
    if not allowed:
        return f"{_A(s)} is not permitted to sell gold under the GoldBod trading framework."
    return (f"{_A(s)} may not sell to {_a(b)}. Under GoldBod rules {_a(s)} may only sell to: "
            + ", ".join(allowed) + ".")


def may_buy_from(buyer_role: str) -> list[str]:
    return [s for s, buyers in FLOW.items() if buyer_role in buyers]


def licence_status(user) -> dict:
    """Does this user hold the licence their trading role requires?

    Returns {"required": bool, "ok": bool, "label": str, "detail": str,
             "licence_number": str|None, "expires_at": date|None}.
    """
    role = getattr(user, "role", "")
    if role in GOLDBOD_ROLES or getattr(user, "is_superuser", False):
        return {"required": False, "ok": True, "label": "GoldBod authority",
                "detail": "Acts for GoldBod — no trading licence required.",
                "licence_number": None, "expires_at": None}
    if role in MINING_LICENCE_ROLES:
        from miners.models import Miner
        miner = Miner.objects.filter(user=user).first()
        if role == R.MINING_COMPANY.value and miner is None and getattr(user, "company_id", None):
            miner = Miner.objects.filter(company_id=user.company_id).first()
        if miner is None:
            return {"required": True, "ok": False, "label": "No mining licence",
                    "detail": "No mining licence is registered for this account.",
                    "licence_number": None, "expires_at": None}
        ok = miner.license_status == "active"
        return {"required": True, "ok": ok, "label": f"Mining licence {miner.get_license_status_display().lower()}",
                "detail": ("Mining licence is active." if ok else
                           f"Mining licence {miner.license_number} is {miner.get_license_status_display().lower()}."),
                "licence_number": miner.license_number, "expires_at": miner.license_expiry}
    types = REQUIRED_LICENCE.get(role)
    if not types:
        return {"required": False, "ok": True, "label": "Not a trading role",
                "detail": "This role does not buy or sell gold.", "licence_number": None, "expires_at": None}
    from licensing.models import License
    lic = (License.objects.filter(holder=user, license_type__in=types)
           .order_by("-created_at").first())
    if lic is None:
        return {"required": True, "ok": False, "label": "No GoldBod licence",
                "detail": f"{_A(ROLE_LABEL.get(role, role))} must hold a GoldBod "
                          f"{' or '.join(t.replace('_', ' ') for t in types)} licence.",
                "licence_number": None, "expires_at": None}
    ok = lic.is_valid
    if ok:
        detail = f"Licence {lic.license_number} is active."
    elif lic.status == "active":
        detail = f"Licence {lic.license_number} expired on {lic.expires_at:%d %b %Y}."
    else:
        detail = f"Licence {lic.license_number} is {lic.get_status_display().lower()}."
    return {"required": True, "ok": ok,
            "label": "Licence valid" if ok else "Licence not valid",
            "detail": detail, "licence_number": lic.license_number, "expires_at": lic.expires_at}


def rulebook() -> dict:
    """Machine- and human-readable rules for the UI."""
    roles = sorted(TRADING_ROLES, key=lambda r: FLOW_ORDER.index(r) if r in FLOW_ORDER else 99)
    out = []
    for r in roles:
        out.append({
            "role": r, "label": ROLE_LABEL.get(r, r),
            "sells_to": [{"role": b, "label": ROLE_LABEL.get(b, b), "basis": why}
                         for b, (_, why) in FLOW.get(r, {}).items()],
            "buys_from": [{"role": s, "label": ROLE_LABEL.get(s, s)} for s in may_buy_from(r)],
            "licence": ("Valid mining licence" if r in MINING_LICENCE_ROLES else
                        "Acts for GoldBod" if r in GOLDBOD_ROLES else
                        f"GoldBod {' / '.join(t.replace('_', ' ') for t in REQUIRED_LICENCE[r])} licence"
                        if r in REQUIRED_LICENCE else "Approved off-taker (KYC cleared)"),
        })
    return {"roles": out, "principles": [
        "GoldBod is the central buyer, assayer, valuer and exporter of gold in Ghana.",
        "Gold moves Miner → Tier 1 → Tier 2 → Aggregator → GoldBod → Refinery / Exporter → Off-taker; "
        "a trade may skip ahead where the rules allow (e.g. a miner selling straight to an aggregator) but never go backward.",
        "Every trader must hold a valid licence for its tier; miners must hold an active mining licence.",
        "Foreign buyers may not trade gold locally — they only off-take from GoldBod or its licensed exporters.",
        "Prices are referenced to the Bank of Ghana reference rate; prices far from it are held for review.",
        "Every sale needs an assayed lot, an intact custody record and a payment receipt.",
        "Gold whose origin lies outside any licensed concession, or near an illegal-mining site, is held or refused.",
    ]}
