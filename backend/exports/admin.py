from django.contrib import admin

from .models import ExportCertificate


@admin.register(ExportCertificate)
class ExportCertificateAdmin(admin.ModelAdmin):
    list_display = ("certificate_number", "batch", "exporter", "destination_country", "status", "issued_at")
    list_filter = ("status", "destination_country")
    search_fields = ("certificate_number", "batch__batch_code")
    readonly_fields = ("certificate_number", "certificate_hash", "qr_image", "anchored_tx")
