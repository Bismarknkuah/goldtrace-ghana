from django.contrib import admin

from .models import DueDiligence, KycScreening


@admin.register(KycScreening)
class KycScreeningAdmin(admin.ModelAdmin):
    list_display = ("subject_name", "country", "risk_rating", "status", "sanctions_hit", "pep")
    list_filter = ("status", "risk_rating", "sanctions_hit")


@admin.register(DueDiligence)
class DueDiligenceAdmin(admin.ModelAdmin):
    list_display = ("batch", "origin_verified", "conflict_free", "oecd_conformant", "oecd_step")
