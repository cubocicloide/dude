from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.users.models import User
from apps.users.serializers import UserSerializer


@extend_schema(tags=["Users"])
@extend_schema_view(
    list=extend_schema(
        summary="List users",
        description=(
            "Paginated and ordered by `id` ascending. Select a page with "
            "`?page=<n>`; the page size is fixed at 50. Results always come back "
            "in the envelope (`count`, `next`, `previous`, `results`), never as a "
            "bare array."
        ),
    ),
    retrieve=extend_schema(
        summary="Retrieve a user",
        description=(
            'An unknown id returns `404` with `{"detail": "No User matches the given query."}`.'
        ),
    ),
)
class UserViewSet(ReadOnlyModelViewSet):
    """List (paginated) and retrieve users.

    Write operations belong in ``apps.users.services`` (see ``create_user``) —
    views never touch the ORM for writes (lint rule BE005).
    """

    queryset = User.objects.all()
    serializer_class = UserSerializer
    # Demo endpoint: AllowAny so the scaffold works out of the box. Tighten to
    # IsAuthenticated before exposing real user data — but keep the declaration
    # explicit: every view must declare permission_classes (lint rule BE003).
    permission_classes = [AllowAny]
