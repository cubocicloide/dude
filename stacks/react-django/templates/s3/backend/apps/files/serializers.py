from rest_framework import serializers

from apps.files.models import FileUpload
from apps.files.services import create_file_upload


class FileUploadSerializer(serializers.ModelSerializer):
    """Representation of a stored file.

    ``file`` is write-only (the upload); clients read the presigned ``url``
    instead. Fields are always listed explicitly (lint rule BE002).
    """

    file = serializers.FileField(write_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = FileUpload
        fields = ("id", "file", "url", "original_name", "content_type", "size", "created_at")
        read_only_fields = ("id", "original_name", "content_type", "size", "created_at")

    def get_url(self, obj: FileUpload) -> str:
        # Presigned URL when the S3 backend is active (AWS_QUERYSTRING_AUTH).
        return obj.file.url

    def create(self, validated_data: dict) -> FileUpload:
        return create_file_upload(uploaded=validated_data["file"])
