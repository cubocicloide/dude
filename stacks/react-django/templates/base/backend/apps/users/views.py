from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.users.models import User
from apps.users.serializers import UserSerializer


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
