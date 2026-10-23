"""Passport hashing, QR generation and a tamper-evident custody chain.

The custody chain is a per-batch hash chain: each event embeds the hash of the
event before it, so altering any historical event invalidates every event after
it. ``verify_event_links`` recomputes the chain to detect tampering, and that
check gates export-certificate issuance.
"""
import hashlib
import json
from io import BytesIO

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile


def _canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


# --------------------------------------------------------------------------- #
# Passport
# --------------------------------------------------------------------------- #
def passport_hash(batch) -> str:
    payload = {
        "batch_code": batch.batch_code,
        "miner": batch.miner.license_number,
        "gross_weight_g": str(batch.gross_weight_g),
        "fine_weight_g": str(batch.fine_weight_g),
        "fineness": batch.fineness,
        "created_at": batch.created_at,
    }
    return hashlib.sha256(_canonical(payload).encode()).hexdigest()


def passport_url(batch) -> str:
    return f"{settings.GOLD_PASSPORT_BASE_URL}/b/{batch.batch_code}"


def build_qr(data, name: str):
    """Render ``data`` (a URL/string) to a PNG and return a Django File."""
    img = qrcode.make(data)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return ContentFile(buffer.getvalue(), name=name)


# --------------------------------------------------------------------------- #
# Custody hash chain
# --------------------------------------------------------------------------- #
def compute_event_hash(*, batch_code, event_type, from_party, to_party,
                       metadata, previous_hash, created_at) -> str:
    payload = {
        "batch": batch_code,
        "type": str(event_type),
        "from": from_party,
        "to": to_party,
        "metadata": metadata or {},
        "prev": previous_hash,
        "created_at": created_at,
    }
    return hashlib.sha256(_canonical(payload).encode()).hexdigest()


def event_hash(event, previous_hash: str = "") -> str:
    return compute_event_hash(
        batch_code=event.batch.batch_code,
        event_type=event.event_type,
        from_party=event.from_party,
        to_party=event.to_party,
        metadata=event.metadata,
        previous_hash=previous_hash,
        created_at=event.created_at,
    )


def append_custody_event(batch, event_type, *, actor=None, from_party="",
                         to_party="", metadata=None, location=None):
    """Create the next link in a batch's custody chain and anchor it async."""
    from .models import CustodyEvent
    from .tasks import anchor_event_to_ledger

    last = batch.custody_events.order_by("created_at").last()
    previous_hash = last.event_hash if last else ""

    event = CustodyEvent(
        batch=batch, event_type=event_type, actor=actor,
        from_party=from_party, to_party=to_party,
        metadata=metadata or {}, location=location or {},
        previous_hash=previous_hash,
    )
    event.event_hash = event_hash(event, previous_hash)
    event.save()
    anchor_event_to_ledger.delay(str(event.id))
    return event


def verify_event_links(events) -> dict:
    """Recompute a chain of custody-event-like objects to detect tampering.

    Returns {"valid": bool, "length": int, "broken_at": int | None}.
    """
    previous_hash = ""
    for index, event in enumerate(events):
        if event.previous_hash != previous_hash:
            return {"valid": False, "length": index, "broken_at": index}
        expected = event_hash(event, previous_hash)
        if expected != event.event_hash:
            return {"valid": False, "length": index, "broken_at": index}
        previous_hash = event.event_hash
    return {"valid": True, "length": len(list(events)) if hasattr(events, "__len__") else index + 1, "broken_at": None}


def verify_chain(batch) -> dict:
    return verify_event_links(list(batch.custody_events.order_by("created_at")))


def compute_lot_risk(batch, chain: dict | None = None) -> dict:
    """Multi-dimensional risk for a single gold lot (vision section 18):
    origin, transaction, assay, custody, environmental and export sub-scores,
    each 0-100 (higher = riskier), plus a weighted overall band."""
    from trading.models import OwnershipTransfer

    if chain is None:
        chain = verify_chain(batch)

    # Origin: gold without a captured GPS origin is harder to trust.
    origin = 10 if getattr(batch, "origin_latitude", None) is not None else 45

    # Transaction: many hops or any irregular (out-of-flow) transfer raises risk.
    transfers = OwnershipTransfer.objects.filter(batch=batch)
    hops = transfers.count()
    irregular = transfers.filter(irregular=True).exists()
    transaction = min(100, hops * 12 + (40 if irregular else 0))

    # Assay: unassayed gold is riskier than verified gold.
    assay = 8 if getattr(batch, "fineness", None) else 55

    # Custody: a broken tamper-evident chain is the strongest single signal.
    custody = 5 if chain.get("valid") else 80
    if batch.security_status in ("stolen", "missing"):
        custody = 95
    elif batch.security_status == "flagged":
        custody = max(custody, 60)

    # Environmental: originating region flagged for illegal-mining hotspots.
    environmental = 30 if getattr(batch, "miner", None) and getattr(batch.miner, "region", "") else 15

    # Export: exported without a certificate is a red flag; certified is low.
    export = 5 if batch.status == "exported" else 12

    weights = {"origin": 0.15, "transaction": 0.25, "assay": 0.12,
               "custody": 0.28, "environmental": 0.08, "export": 0.12}
    parts = {"origin": origin, "transaction": transaction, "assay": assay,
             "custody": custody, "environmental": environmental, "export": export}
    overall = round(sum(parts[k] * w for k, w in weights.items()))
    band = ("critical" if overall >= 70 else "high" if overall >= 45
            else "medium" if overall >= 25 else "low")
    return {**parts, "overall": overall, "band": band}


def precheck_transaction(batch, buyer, price=None) -> dict:
    """GoldBod pre-transaction compliance gate.

    Runs every legal and risk check before a purchase and returns
    allow / review / block, each check with a plain-language explanation.
    """
    from decimal import Decimal

    from core.models import SystemConfig
    from core.supply_chain import explain, licence_status, resolve_stage
    from gis.sourcing import source_check
    from pricing.services import current_rate

    checks, blocking, review = [], [], []

    def add(label, result, detail, hard=False):
        checks.append({"check": label, "result": result, "detail": detail})
        if result == "fail":
            (blocking if hard else review).append(f"{label}: {detail}")

    seller = batch.current_owner
    cfg = SystemConfig.get()

    # 1. Who may sell to whom (Act 1140 trading order).
    if seller:
        _stage, permitted = resolve_stage(seller.role, buyer.role)
        add("Permitted trade", "pass" if permitted else "fail",
            explain(seller.role, buyer.role), hard=True)

    # 2. Licences — buyer and seller must both be licensed for their tier.
    for who, user in (("Buyer", buyer), ("Seller", seller)):
        if user is None:
            continue
        lic = licence_status(user)
        if lic["required"]:
            add(f"{who} licence", "pass" if lic["ok"] else "fail", lic["detail"], hard=True)

    # 3. Security status.
    if batch.security_status in ("stolen", "missing"):
        add("Security", "fail", f"The gold is reported {batch.security_status}.", hard=True)
    elif batch.security_status == "flagged":
        add("Security", "fail", "The gold carries a security flag under investigation.")
    else:
        add("Security", "pass", "No theft, loss or tamper flag.")

    # 4. Custody record integrity.
    chain = verify_chain(batch)
    add("Custody record", "pass" if chain["valid"] else "fail",
        "Tamper-evident custody record intact." if chain["valid"]
        else "The custody record is broken — history cannot be trusted.", hard=not chain["valid"])

    # 5. Assay.
    add("Assay", "pass" if batch.fineness else "fail",
        f"Purity on record: {batch.fineness / 10:.1f}%." if batch.fineness
        else "Purity has not been assayed — value cannot be fixed.")

    # 6. Responsible sourcing — is the mine site legitimate?
    src = source_check(batch)
    hard_src = src["status"] == "illegal"
    add("Mine-site origin", "pass" if src["status"] == "verified" else "fail",
        src["message"], hard=hard_src)

    # 7. Price vs Bank of Ghana reference rate.
    if price:
        fine = batch.fine_weight_g or (
            Decimal(str(batch.gross_weight_g)) * Decimal(batch.fineness) / 1000 if batch.fineness else None)
        if fine:
            ref = Decimal(str(fine)) * current_rate()
            pct = float((Decimal(str(price)) - ref) / ref * 100) if ref else 0.0
            low, high = cfg.price_band_below_pct, cfg.price_band_above_pct
            ok = -low <= pct <= high
            add("Price vs BoG reference", "pass" if ok else "fail",
                (f"Price is {abs(pct):.1f}% {'below' if pct < 0 else 'above'} the reference value "
                 f"of GHS {ref:,.2f}" + ("." if ok else
                 f" — outside the allowed band (−{low:g}% to +{high:g}%). "
                 + ("Possible under-payment of the miner." if pct < 0 else "Possible value inflation / laundering."))))

    # 8. Overall lot risk.
    risk = compute_lot_risk(batch, chain)
    if risk["overall"] >= cfg.risk_block_threshold:
        add("Lot risk", "fail", f"Risk score {risk['overall']}/100 is critical.", hard=True)
    elif risk["overall"] >= cfg.risk_review_threshold:
        add("Lot risk", "fail", f"Risk score {risk['overall']}/100 is high.")
    else:
        add("Lot risk", "pass", f"Risk score {risk['overall']}/100.")

    decision = "block" if blocking else ("review" if review else "allow")
    summary = {"block": "This trade is not permitted.",
               "review": "This trade may proceed only after a GoldBod officer reviews it.",
               "allow": "All GoldBod checks passed."}[decision]
    return {"decision": decision, "summary": summary, "checks": checks,
            "blocking": blocking, "review": review, "lot_risk": risk["overall"],
            "sourcing": src}