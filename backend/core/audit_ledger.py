"""Append-only, hash-chained audit ledger + a domain-event publisher seam.

The publisher is deliberately swappable: today it writes to the ledger (system of
record). A Kafka/event-bus backend can be dropped in behind `publish_event`
without changing callers (event-driven principle).
"""
from __future__ import annotations


def seal_entry(entry) -> None:
    """Seal an AuditLog entry into the hash chain before it is saved."""
    from core.models import AuditLog
    last = AuditLog.objects.exclude(entry_hash="").order_by("-created_at").first()
    entry.prev_hash = last.entry_hash if last else ""
    entry.entry_hash = entry.compute_hash(entry.prev_hash)


def verify_chain(limit: int = 5000) -> dict:
    """Walk the ledger newest->oldest and confirm each link is intact."""
    from core.models import AuditLog
    rows = list(AuditLog.objects.exclude(entry_hash="").order_by("created_at")[:limit])
    broken_at = None
    prev = ""
    for i, r in enumerate(rows):
        if r.prev_hash != prev or r.entry_hash != r.compute_hash(prev):
            broken_at = i
            break
        prev = r.entry_hash
    return {"length": len(rows), "valid": broken_at is None, "broken_at": broken_at}


def publish_event(event_type: str, *, actor=None, subject: str = "", data: dict | None = None):
    """Domain-event publish seam. Records the event in the audit ledger today;
    point this at Kafka later without touching callers."""
    from core.models import AuditLog
    entry = AuditLog(
        actor=actor,
        actor_role=getattr(actor, "role", "") or "",
        method="EVENT",
        path=f"{event_type}:{subject}"[:255],
        status_code=200,
    )
    seal_entry(entry)
    entry.save()
    return entry
