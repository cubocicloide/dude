"""Write-side operations for the files app.

Views never touch the ORM for writes (lint rule BE005) — creation goes
through this module so upload bookkeeping lives in exactly one place.
"""

from django.core.files.uploadedfile import UploadedFile

from apps.files.models import FileUpload


def create_file_upload(uploaded: UploadedFile) -> FileUpload:
    """Persist an uploaded file, capturing its original metadata."""
    return FileUpload.objects.create(
        file=uploaded,
        original_name=uploaded.name or "",
        content_type=getattr(uploaded, "content_type", "") or "",
        size=uploaded.size or 0,
    )
