from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.serializers import HealthSerializer


class HealthView(APIView):
    """Health-check endpoint used by the frontend and by container probes."""

    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="health_retrieve",
        description="Health-check endpoint.",
        responses=HealthSerializer,
        tags=["health"],
        auth=[],
    )
    def get(self, request: Request) -> Response:
        serializer = HealthSerializer({"status": "ok"})
        return Response(serializer.data)
