from django.apps import AppConfig


class MinersConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "miners"
