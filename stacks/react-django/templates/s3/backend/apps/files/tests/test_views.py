import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def in_memory_storage(settings):
    # Tests never talk to MinIO/S3 — swap the default backend for an
    # in-memory one so uploads stay inside the test process.
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }


@pytest.mark.django_db
def test_upload_list_retrieve():
    client = APIClient()
    payload = SimpleUploadedFile("hello.txt", b"hi there", content_type="text/plain")

    created = client.post("/api/files/", {"file": payload}, format="multipart")
    assert created.status_code == 201
    assert created.data["original_name"] == "hello.txt"
    assert created.data["size"] == 8

    listed = client.get("/api/files/")
    assert listed.status_code == 200
    assert listed.data["count"] == 1

    detail = client.get(f"/api/files/{created.data['id']}/")
    assert detail.status_code == 200
    assert detail.data["url"]
