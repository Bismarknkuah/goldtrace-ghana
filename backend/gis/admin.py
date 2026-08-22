from django.contrib import admin

from .models import Hotspot


@admin.register(Hotspot)
class HotspotAdmin(admin.ModelAdmin):
    list_display = ("title", "severity", "status", "region", "source", "created_at")
    list_filter = ("severity", "status", "region")
    search_fields = ("title", "region")
