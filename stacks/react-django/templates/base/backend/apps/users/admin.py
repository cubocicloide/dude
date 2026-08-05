from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from apps.users.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    """Django's user admin, restyled by Unfold.

    ``BaseUserAdmin`` comes first so its fieldsets and password handling win;
    ``ModelAdmin`` (Unfold's) supplies the templates.

    The three form overrides are not optional: Django's auth forms ship their own
    widgets, so without Unfold's replacements the add / change / set-password
    screens render unstyled inside the themed layout.
    """

    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
