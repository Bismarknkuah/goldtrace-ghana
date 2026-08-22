from django.apps import AppConfig


class RevenueConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "revenue"
