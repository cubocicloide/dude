import pytest

from apps.users.models import User
from apps.users.services import create_user


@pytest.mark.django_db
def test_create_user_hashes_password() -> None:
    user = create_user(username="alice", email="alice@example.com", password="s3cret-pass!")

    assert user.pk is not None
    assert user.password != "s3cret-pass!"
    assert user.check_password("s3cret-pass!")


@pytest.mark.django_db
def test_str_returns_username() -> None:
    user = create_user(username="bob")

    assert str(user) == "bob"


@pytest.mark.django_db
def test_default_ordering_is_by_id() -> None:
    create_user(username="zoe")
    create_user(username="adam")

    ids = [user.pk for user in User.objects.all()]

    assert ids == sorted(ids)
