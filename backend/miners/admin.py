from django.contrib import admin

from .models import Concession, Miner, MinerDocument, MiningCompany


@admin.register(Miner)
class MinerAdmin(admin.ModelAdmin):
    list_display = ("license_number", "user", "license_status", "region", "license_expiry")
    list_filter = ("license_status", "region")
    search_fields = ("license_number", "user__username")


@admin.register(Concession)
class ConcessionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "miner", "region", "area_hectares", "is_active")
    list_filter = ("region", "is_active")
    search_fields = ("code", "name")


@admin.register(MinerDocument)
class MinerDocumentAdmin(admin.ModelAdmin):
    list_display = ("miner", "doc_type", "created_at")
    list_filter = ("doc_type",)


@admin.register(MiningCompany)
class MiningCompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "registration_no", "region", "is_active")
    search_fields = ("name", "registration_no")
