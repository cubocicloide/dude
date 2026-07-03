from rest_framework.routers import DefaultRouter

from apps.files.views import FileUploadViewSet

app_name = "files"

router = DefaultRouter()
router.register("files", FileUploadViewSet, basename="files")

urlpatterns = router.urls
