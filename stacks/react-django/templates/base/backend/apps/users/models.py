from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Project user (custom model — extend with profile fields as needed).

    Referenced everywhere via ``settings.AUTH_USER_MODEL`` /
    ``django.contrib.auth.get_user_model()``.
    """

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.username
