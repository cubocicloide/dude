---
'@cubocicloide/dude': minor
'@cubocicloide/stack-react-fastapi': minor
'@cubocicloide/stack-react-django': minor
'@cubocicloide/stack-fastmcp': minor
'@cubocicloide/stack-tauri': minor
'@cubocicloide/stack-frappe': minor
'@cubocicloide/stack-airflow': minor
---

Move the `docs` command into the CLI as `defineDocsCommand()`, which every stack
now registers — the same pattern as `defineLintCommand()`. The six stacks were
carrying byte-identical 117-line copies, so adding a generated page meant editing
six places; it is one place now.

The shared command refreshes every generated page the scaffold ships before
serving: `api.md` from the live command catalog, and `cheatsheet.md` from the
project's rules and answers. Each refresh is independent and best-effort, so a
failure leaves the committed placeholder and never blocks serving.

Each stack's project documentation site now includes a **Cheatsheet** page,
regenerated on every `dude docs` and pointing coding agents at
`dude cheatsheet --format json`.
