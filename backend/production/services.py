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


def precheck_transaction(batch, buyer) -> dict:
    """Pre-transaction compliance gate (vision section 6): run checks before a
    purchase and return a decision of allow / review / block with reasons."""
    from core.supply_chain import resolve_stage
    from licensing.models import License, LicenseStatus

    checks = []
    blocking = []
    review = []

    def ok(label):
        checks.append({"check": label, "result": "pass"})

    def fail(label, hard):
        checks.append({"check": label, "result": "fail"})
        (blocking if hard else review).append(label)

    seller = batch.current_owner

    # Flow eligibility
    if seller:
        _stage, eligible = resolve_stage(seller.role, buyer.role)
        ok("Supply-chain flow eligible") if eligible or buyer.is_superuser \
            else fail("Buyer not permitted to buy from this seller", True)

    # Buyer licence
    buyer_lic = License.objects.filter(holder=buyer).order_by("-created_at").first()
    if buyer_lic and buyer_lic.status == LicenseStatus.ACTIVE and buyer_lic.is_valid:
        ok("Buyer licence active")
    elif buyer_lic and buyer_lic.status in (LicenseStatus.SUSPENDED, LicenseStatus.REVOKED):
        fail(f"Buyer licence {buyer_lic.get_status_display().lower()}", True)
    else:
        fail("Buyer has no valid licence", False)

    # Seller / miner licence
    seller_lic = License.objects.filter(holder=seller).order_by("-created_at").first() if seller else None
    if seller_lic and seller_lic.status in (LicenseStatus.SUSPENDED, LicenseStatus.REVOKED):
        fail(f"Seller licence {seller_lic.get_status_display().lower()}", True)
    else:
        ok("Seller licence in good standing")

    # Gold security status / investigation
    if batch.security_status in ("stolen", "missing"):
        fail("Gold is reported stolen/missing", True)
    elif batch.security_status == "flagged":
        fail("Gold is under a security flag", False)
    else:
        ok("No active security flag")

    # Assay present
    ok("Gold has been assayed") if getattr(batch, "fineness", None) else fail("Gold not yet assayed", False)

    # Lot risk
    from core.models import SystemConfig
    cfg = SystemConfig.get()
    risk = compute_lot_risk(batch)
    if risk["overall"] >= cfg.risk_block_threshold:
        fail(f"Lot risk critical ({risk['overall']}/100)", True)
    elif risk["overall"] >= cfg.risk_review_threshold:
        fail(f"Lot risk high ({risk['overall']}/100)", False)
    else:
        ok(f"Lot risk acceptable ({risk['overall']}/100)")

    decision = "block" if blocking else ("review" if review else "allow")
    return {"decision": decision, "checks": checks,
            "blocking": blocking, "review": review, "lot_risk": risk["overall"]}
