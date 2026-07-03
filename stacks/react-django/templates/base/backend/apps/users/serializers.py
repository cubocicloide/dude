from rest_framework import serializers

from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    """Public representation of a user.

    Fields are always listed explicitly (never ``"__all__"``, lint rule BE002)
    so adding a sensitive column to the model can never leak it by accident.
    """

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "date_joined")
        read_only_fields = ("id", "date_joined")
