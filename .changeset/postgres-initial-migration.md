---
'@cubocicloide/stack-react-fastapi': patch
---

Fix two issues found in the `$`-structure frontend overhaul (major release `11.0.0`):

- **FE lint severity.** FE002, FE005, FE006, FE009, and FE010 now report unrecognized files/directories as **errors** instead of warnings — an unexpected item in a fixed-membership directory (component, hook, page, utils domain, src root) is a structural violation, not a suggestion.
- **Postgres 500 on a fresh `dude up`.** The postgres template shipped no committed Alembic migration for the `User` model, so `alembic upgrade head` (run automatically on every backend container start) was a no-op — the `user` table was never created unless `dude reset` had been run at least once, causing `/api/users` to 500 on a database that only ever saw `dude up`. Added the missing initial migration (`0001_create_user_table`) so the schema is created on the very first `dude up`. The README, docs `index.md`, and docs `dude.md` now also explain (conditionally, for postgres projects) that `dude reset` is still needed once to seed demo data.
