from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User

admin.site.site_header = "GOLDTRACE GHANA — Administration"
admin.site.site_title = "GOLDTRACE GHANA"


@admin.register(User)
class GoldtraceUserAdmin(UserAdmin):
    list_display = ("username", "role", "organization", "is_verified", "is_staff")
    list_filter = ("role", "is_verified", "is_staff")
    search_fields = ("username", "email", "ghana_card_number", "organization")
    fieldsets = UserAdmin.fieldsets + (
        ("GoldBod profile", {
            "fields": ("role", "phone", "organization", "ghana_card_number",
                       "is_verified", "mfa_enabled"),
        }),
    )
