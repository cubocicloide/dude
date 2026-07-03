"""Development settings — the default (DJANGO_SETTINGS_MODULE=config.settings.local).

This is the only settings module allowed to carry an insecure SECRET_KEY
fallback and DEBUG=True (lint rule BE007).
"""

from .base import *  # noqa: F401,F403
from .base import env

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-key-change-me")  # noqa: S105

DEBUG = env.bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = ["*"]

# Serve static files straight from the app/package sources in development —
# no collectstatic needed (and no "missing staticfiles/" warning).
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = True

# The Vite dev server (http://localhost:5173) proxies /api to the backend, but
# allow direct cross-origin calls during development too.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
