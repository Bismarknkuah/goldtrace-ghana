from django.contrib import admin

from .models import CustodyEvent, GoldBatch


class CustodyEventInline(admin.TabularInline):
    model = CustodyEvent
    extra = 0
    readonly_fields = ("event_hash", "previous_hash", "anchored_tx", "created_at")


@admin.register(GoldBatch)
class GoldBatchAdmin(admin.ModelAdmin):
    list_display = ("batch_code", "miner", "gross_weight_g", "fineness", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("batch_code", "miner__license_number")
    readonly_fields = ("batch_code", "passport_hash", "qr_image", "anchored_tx")
    inlines = [CustodyEventInline]


@admin.register(CustodyEvent)
class CustodyEventAdmin(admin.ModelAdmin):
    list_display = ("batch", "event_type", "from_party", "to_party", "anchored_tx", "created_at")
    list_filter = ("event_type",)
