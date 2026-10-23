from django.apps import AppConfig


class PricingConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "pricing"
