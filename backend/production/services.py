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
