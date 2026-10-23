from django.apps import AppConfig


class ProductionConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "production"
