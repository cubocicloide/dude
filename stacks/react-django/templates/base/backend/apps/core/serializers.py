from rest_framework import serializers


class HealthSerializer(serializers.Serializer):
    """Response payload of the health-check endpoint."""

    status = serializers.CharField()
