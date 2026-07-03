from apps.files.models import FileUpload


def test_str_uses_original_name():
    upload = FileUpload(original_name="report.pdf")
    assert str(upload) == "report.pdf"


def test_ordering_is_newest_first():
    assert FileUpload._meta.ordering == ("-created_at",)
