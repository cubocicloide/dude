from django.db import models


class FileUpload(models.Model):
    """A file stored on the object-storage backend (S3 / MinIO locally).

    The binary lives in the bucket; this row keeps the metadata and the
    storage key. Downloads go through presigned URLs (``file.url``).
    """

    file = models.FileField(upload_to="uploads/%Y/%m/")
    original_name = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=127, blank=True, default="")
    size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.original_name or self.file.name
