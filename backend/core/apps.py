from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "core"

    def ready(self):
        from .drf_objectid import apply_objectid_patch
        apply_objectid_patch()
