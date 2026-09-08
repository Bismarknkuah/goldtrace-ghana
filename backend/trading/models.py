"""Gold trading: ownership transfer between parties, recorded on the chain."""
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from production.models import GoldBatch


class TransferStatus(models.TextChoices):
    PENDING = "pending", "Pending confirmation"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class OwnershipTransfer(TimeStampedModel):
    """A purchase / handover of a batch from one party to the next."""

    batch = models.ForeignKey(GoldBatch, on_delete=models.PROTECT, related_name="transfers")
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sales",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchases",
    )
    price = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="GHS")
    status = models.CharField(
        max_length=12, choices=TransferStatus.choices, default=TransferStatus.PENDING, db_index=True,
    )
    stage = models.CharField(max_length=24, default="other", db_index=True)
    irregular = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.batch.batch_code}: {self.seller_id} -> {self.buyer_id} ({self.status})"


def make_receipt_ref():
    import uuid
    return f"RCPT-{uuid.uuid4().hex[:8].upper()}"


class PaymentReceipt(TimeStampedModel):
    """Proof-of-payment issued to the seller so they know who paid, and how much."""

    transfer = models.OneToOneField(
        OwnershipTransfer, on_delete=models.CASCADE, related_name="receipt")
    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="receipts_paid")   # buyer
    payee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="receipts_received")  # seller
    amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="GHS")
    reference = models.CharField(max_length=24, unique=True, default=make_receipt_ref, editable=False)

    def __str__(self):
        return f"{self.reference}: {self.payer_id} -> {self.payee_id} ({self.amount} {self.currency})"
