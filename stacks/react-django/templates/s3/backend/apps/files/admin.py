from django.contrib import admin
from unfold.admin import ModelAdmin

from apps.files.models import FileUpload


@admin.register(FileUpload)
class FileUploadAdmin(ModelAdmin):
    # Unfold's ModelAdmin, not django.contrib.admin's — that is what applies the
    # admin theme (see UNFOLD in config/settings/base.py).
    list_display = ("id", "original_name", "content_type", "size", "created_at")
    readonly_fields = ("created_at",)
