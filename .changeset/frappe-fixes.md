---
'@cubocicloide/stack-frappe': patch
---

Fix Frappe Helpdesk telephony dependency and `apps.txt` append corruption.

- Fetch `telephony` before `helpdesk` in both `docker/init.sh` and `docker/Dockerfile.prod.hbs` — Helpdesk declares `required_apps = ["telephony"]` but Frappe does not auto-fetch it, causing a bare `ModuleNotFoundError` on install.
- Add `append_app_txt()` helper in `docker/init.sh` that ensures a trailing newline before appending to `sites/apps.txt`, preventing entries from being concatenated onto the same line (e.g. `telephonyticketing`).
