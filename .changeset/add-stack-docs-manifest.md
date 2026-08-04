---
'@cubocicloide/dude': minor
'@cubocicloide/stack-react-fastapi': minor
'@cubocicloide/stack-react-django': minor
'@cubocicloide/stack-fastmcp': minor
'@cubocicloide/stack-tauri': minor
'@cubocicloide/stack-frappe': minor
'@cubocicloide/stack-airflow': minor
---

Add an optional `docs` manifest to the stack contract (`StackDefinition.docs`), validated with a new `stackDocsSchema` (exported alongside `StackDocs`) that follows the existing `stackVariableSchema` pattern — plain, serializable data, so it stays safe to pass to future tooling. `loadStack` now validates a declared manifest at load time and throws a descriptive error if it is malformed, so a bad manifest fails loudly instead of silently degrading downstream.

All six stacks (`react-fastapi`, `react-django`, `fastmcp`, `tauri`, `frappe`, `airflow`) now populate the manifest: a one-line tagline, "if you're building…" use cases, headline technologies, the IaC target (when the stack has one), and the exact page set the stack's scaffold ships under `docs/docs/` (including the conditional `deploy.md` from the IaC overlay). No user-visible output changes in this slice — the manifest is typed data for the root-site composer and other documentation tooling to consume in a following change (see issue #113).
