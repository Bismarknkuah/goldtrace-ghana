"""Custody-gap detection — the earliest signal that gold may have gone missing."""
from datetime import timedelta

from django.utils import timezone

from production.models import BatchStatus, SecurityStatus


def at_risk_batches(batches, gap_days=7):
    """Batches whose custody chain has gone quiet while still in circulation.

    A long silence since the last custody event on a batch that hasn't been
    exported or delivered is the first sign of a possible loss.
    """
    cutoff = timezone.now() - timedelta(days=gap_days)
    flagged = []
    for b in batches:
        if b.status == BatchStatus.EXPORTED:
            continue
        if b.security_status in (SecurityStatus.MISSING, SecurityStatus.STOLEN):
            continue
        last = b.custody_events.order_by("created_at").last()
        if last and last.created_at < cutoff:
            flagged.append({
                "batch_code": b.batch_code, "batch_id": str(b.id),
                "last_event": last.get_event_type_display(),
                "silent_since": last.created_at, "status": b.get_status_display(),
            })
    return flagged
