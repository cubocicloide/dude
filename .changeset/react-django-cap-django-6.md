---
'@cubocicloide/stack-react-django': patch
---

Cap Django to `<6.0` in the scaffolded backend's `pyproject.toml`.

`django>=5.1` had no upper bound, so every fresh scaffold resolved to whatever
is newest on PyPI at scaffold time. That is currently Django 6.1.0, which
removed `django.utils.cache.cc_delim_re` — an internal that djangorestframework
3.17.2 (also the newest published release, and with no fix yet) still imports.
The result: every new `react-django` project's backend crash-looped on `dude up`
with `ImportError: cannot import name 'cc_delim_re'`, and 7 of 10 backend tests
failed with the same trace.

Verified against a real scaffold: `uv sync` now resolves Django 5.2.17 +
djangorestframework 3.17.2 + drf-spectacular 0.30.0, `dude test` passes 10/10,
and `dude up --build` boots the backend cleanly (migrations apply, server stays
up, no restart loop).

Affects `latest` (3.3.0) as much as `next` (3.4.0) — the range was never
version-specific, so this was breaking every scaffold regardless of channel
before this fix.
