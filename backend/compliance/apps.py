from django.apps import AppConfig


class ComplianceConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "compliance"
