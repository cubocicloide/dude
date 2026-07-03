from django.contrib import admin

from apps.files.models import FileUpload


@admin.register(FileUpload)
class FileUploadAdmin(admin.ModelAdmin):
    list_display = ("id", "original_name", "content_type", "size", "created_at")
    readonly_fields = ("created_at",)
