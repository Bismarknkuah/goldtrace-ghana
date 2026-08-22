"""Async work: anchoring custody-event hashes to Hyperledger Fabric.

The worker calls the Fabric Gateway sidecar (see ../blockchain/gateway) over
HTTP. When anchoring is disabled or no gateway is configured, a deterministic
stub tx-id is recorded so the rest of the system keeps functioning in dev.
"""
import json
import logging
import urllib.request

from celery import shared_task
from django.conf import settings

logger = logging.getLogger("goldtrace.blockchain")


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def anchor_event_to_ledger(self, event_id: str):
    from .models import CustodyEvent

    event = CustodyEvent.objects.filter(id=event_id).select_related("batch").first()
    if not event:
        return None

    try:
        if settings.BLOCKCHAIN_ANCHORING_ENABLED and settings.FABRIC_GATEWAY_URL:
            tx_id = _submit_to_fabric(event)
        else:
            tx_id = f"stub-{event.event_hash[:16]}"
    except Exception as exc:  # network / gateway hiccup -> retry
        logger.warning("anchoring failed for %s: %s", event_id, exc)
        raise self.retry(exc=exc)

    event.anchored_tx = tx_id
    event.save(update_fields=["anchored_tx"])
    logger.info("anchored event %s -> %s", event_id, tx_id)
    return tx_id


def _submit_to_fabric(event) -> str:
    """POST the event hash to the Fabric Gateway sidecar; return the tx id."""
    payload = json.dumps({
        "eventId": str(event.id),
        "batchCode": event.batch.batch_code,
        "eventHash": event.event_hash,
        "previousHash": event.previous_hash,
        "eventType": event.event_type,
        "timestamp": event.created_at.isoformat() if event.created_at else "",
    }).encode()

    url = settings.FABRIC_GATEWAY_URL.rstrip("/") + "/anchor"
    req = urllib.request.Request(url, data=payload,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = json.loads(resp.read().decode())
    return body.get("txId", "")
