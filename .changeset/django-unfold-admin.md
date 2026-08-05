---
'@cubocicloide/stack-react-django': minor
---

Scaffold the Django admin with [django-unfold](https://unfoldadmin.com) instead of
the stock theme.

`unfold` and its dependency-free contrib modules are added as a new `ADMIN_APPS`
list, prepended to `INSTALLED_APPS` — Unfold themes the admin by overriding its
templates, so it has to resolve before `django.contrib.admin`. A minimal `UNFOLD`
settings dict carries the site title, header and sidebar search.

The scaffold's own `ModelAdmin` registrations now subclass `unfold.admin.ModelAdmin`,
so `/admin/` renders themed out of the box. `apps/users/admin.py` also takes
Unfold's `UserChangeForm` / `UserCreationForm` / `AdminPasswordChangeForm`, without
which Django's auth screens render unstyled inside the themed layout.
