"""Write operations for the users app.

All ORM writes live in service functions — never in views (lint rule BE005).
Views stay thin; business rules live here, in one importable, testable place.
"""

from typing import Any

from apps.users.models import User


def create_user(
    *,
    username: str,
    email: str = "",
    password: str | None = None,
    **extra_fields: Any,
) -> User:
    """Create a user with a properly hashed password."""
    return User.objects.create_user(
        username=username,
        email=email,
        password=password,
        **extra_fields,
    )
