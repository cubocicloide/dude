import pytest
from rest_framework.test import APIClient

from apps.users.services import create_user

EXPECTED_FIELDS = {"id", "username", "email", "first_name", "last_name", "date_joined"}


@pytest.mark.django_db
def test_list_users_is_paginated() -> None:
    create_user(username="alice", email="alice@example.com")
    create_user(username="bob", email="bob@example.com")

    response = APIClient().get("/api/users/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 2
    assert [item["username"] for item in payload["results"]] == ["alice", "bob"]


@pytest.mark.django_db
def test_list_users_exposes_only_declared_fields() -> None:
    create_user(username="alice", email="alice@example.com")

    payload = APIClient().get("/api/users/").json()

    assert set(payload["results"][0]) == EXPECTED_FIELDS


@pytest.mark.django_db
def test_retrieve_user_by_id() -> None:
    user = create_user(username="alice", email="alice@example.com", first_name="Alice")

    response = APIClient().get(f"/api/users/{user.pk}/")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user.pk
    assert body["username"] == "alice"
    assert body["first_name"] == "Alice"


@pytest.mark.django_db
def test_retrieve_unknown_user_returns_404() -> None:
    response = APIClient().get("/api/users/9999/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_users_are_read_only_over_the_api() -> None:
    response = APIClient().post("/api/users/", {"username": "mallory"})

    assert response.status_code == 405
