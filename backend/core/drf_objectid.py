"""Make Django REST Framework serialize MongoDB ObjectId values as strings.

DRF maps auto-increment primary keys to IntegerField and calls int() on them.
MongoDB primary/foreign keys are ObjectId (hex), not integers, so DRF crashes
with "int() argument must be ... not 'ObjectId'". This patch teaches DRF to
render ObjectId fields (and ObjectId primary keys of related fields) as strings.
Applied once at startup from CoreConfig.ready().
"""


def apply_objectid_patch():
    from rest_framework import serializers
    from rest_framework.relations import PrimaryKeyRelatedField

    try:
        from bson import ObjectId
    except Exception:  # pragma: no cover
        return

    # 1) Auto-built serializer fields for ObjectId model fields -> CharField.
    try:
        from django_mongodb_backend.fields import ObjectIdAutoField, ObjectIdField
        serializers.ModelSerializer.serializer_field_mapping[ObjectIdAutoField] = serializers.CharField
        serializers.ModelSerializer.serializer_field_mapping[ObjectIdField] = serializers.CharField
    except Exception:
        pass

    # 2) Related fields (FKs) return the related object's pk — stringify ObjectId.
    if not getattr(PrimaryKeyRelatedField, "_objectid_patched", False):
        _orig = PrimaryKeyRelatedField.to_representation

        def to_representation(self, value):
            result = _orig(self, value)
            if isinstance(result, ObjectId):
                return str(result)
            return result

        PrimaryKeyRelatedField.to_representation = to_representation
        PrimaryKeyRelatedField._objectid_patched = True

    # 3) Final safety net: DRF's JSON encoder renders any ObjectId as str.
    try:
        from rest_framework.utils import encoders
        if not getattr(encoders.JSONEncoder, "_objectid_patched", False):
            _orig_default = encoders.JSONEncoder.default

            def default(self, obj):
                if isinstance(obj, ObjectId):
                    return str(obj)
                return _orig_default(self, obj)

            encoders.JSONEncoder.default = default
            encoders.JSONEncoder._objectid_patched = True
    except Exception:
        pass
