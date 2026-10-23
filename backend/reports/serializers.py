from rest_framework import serializers

from .models import PublicReport, ReportLink


class ReportLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportLink
        fields = ("id", "token", "title", "active", "submissions", "created_at")
        read_only_fields = ("id", "token", "submissions", "created_at")


class PublicReportSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    assigned_names = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()

    class Meta:
        model = PublicReport
        fields = ("id", "category", "category_display", "description", "reporter_name",
                  "reporter_phone", "latitude", "longitude", "region", "location_text",
                  "attachments", "attachment_count", "status", "status_display",
                  "assigned_to", "assigned_names", "detection", "officer_note", "created_at")
        read_only_fields = ("id", "status", "assigned_to", "detection", "created_at")

    def get_assigned_names(self, o):
        return [u.username for u in o.assigned_to.all()]

    def get_attachment_count(self, o):
        return len(o.attachments or [])


class PublicSubmitSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=[c[0] for c in PublicReport._meta.get_field("category").choices])
    description = serializers.CharField()
    reporter_name = serializers.CharField(required=False, allow_blank=True)
    reporter_phone = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    region = serializers.CharField(required=False, allow_blank=True)
    location_text = serializers.CharField(required=False, allow_blank=True)
    attachments = serializers.ListField(child=serializers.DictField(), required=False)
