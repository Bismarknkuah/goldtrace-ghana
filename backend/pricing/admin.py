from django.contrib import admin

from .models import ReferenceRate


@admin.register(ReferenceRate)
class ReferenceRateAdmin(admin.ModelAdmin):
    list_display = ("rate_ghs_per_g", "effective_date", "source", "set_by")
