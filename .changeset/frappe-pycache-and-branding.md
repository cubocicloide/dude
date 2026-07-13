---
'@cubocicloide/stack-frappe': patch
---

Fix `dude lint` false positives on `__pycache__` and add customizable branding to the `ticketing` example app.

- DT001–DT004 and PY003 no longer treat a `doctype/__pycache__/` directory (created by running the bench) as a DocType bundle — `listDoctypeDirs()` now excludes `__pycache__` and dotfiles when listing doctype directory names.
- Add `ticketing/public/images/logo.png` and `favicon.png` placeholder assets, wired via `app_logo_url` / `website_context.favicon` in `hooks.py` (Desk + portal) and a new `set_default_branding` patch that points Helpdesk's own `HD Settings.brand_logo` / `favicon` at the same files. Rebranding is a file swap — no code or database change needed.
- `docker/init.sh` now runs `bench build --app <app>` for symlinked custom apps (previously only apps fetched via `bench get-app` got their assets built, so a custom app's own static assets — e.g. the new branding images — would 404).
