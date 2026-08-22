from django.contrib import admin

from .models import License


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ("license_number", "license_type", "holder", "status", "expires_at")
    list_filter = ("license_type", "status")
    search_fields = ("license_number",)
