from django.contrib import admin

from .models import OwnershipTransfer, PaymentReceipt


@admin.register(OwnershipTransfer)
class OwnershipTransferAdmin(admin.ModelAdmin):
    list_display = ("batch", "seller", "buyer", "price", "currency", "status", "completed_at")
    list_filter = ("status", "currency")
    search_fields = ("batch__batch_code",)


@admin.register(PaymentReceipt)
class PaymentReceiptAdmin(admin.ModelAdmin):
    list_display = ("reference", "payer", "payee", "amount", "currency", "created_at")
    search_fields = ("reference",)
