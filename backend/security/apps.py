from django.apps import AppConfig


class SecurityConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "security"
    label = "gold_security"
