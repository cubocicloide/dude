---
'@cubocicloide/stack-airflow': minor
'@cubocicloide/stack-fastmcp': minor
'@cubocicloide/stack-tauri': minor
'@cubocicloide/stack-frappe': minor
'@cubocicloide/stack-react-fastapi': patch
'@cubocicloide/stack-react-django': patch
---

Bring the agent-facing surface to parity across all six stacks.

`airflow` and `fastmcp` shipped no skills at all; `tauri` and `frappe` shipped a
partial set, and three stacks had no `.vscode/tasks.json` and no `issue-fixer`
agent. Every stack now ships the same minimum: the lint-watch editor task, an
`issue-fixer` agent, the stack-agnostic workflow skills, and `create-*` skills
for its own primary artifacts — each one written against that stack's real
commands and lint rules, and ending in a `dude lint --format json` /
`dude explain <CODE>` verification step.

New per stack:

- **airflow** — `create-dag`, `create-connection`, a `create` router, tasks.json, issue-fixer.
- **fastmcp** — `create-feature`, `create-tool`, a `create` router, tasks.json, issue-fixer, security-fixer, and the security/Jira skill set it was missing despite registering `dude security`.
- **tauri** — `add-plugin`, `release-mobile`, a `create` router, tasks.json, issue-fixer.
- **frappe** — `create-hook`, `create-api-method`, a `create` router, issue-fixer.

Also fixed, found while doing this:

- `frappe`'s `docs/extending.md` attributed `doc_events` to APP002 and fixtures to APP003; the real codes are APP003 and APP004.
- The shared `fix-issues` skill told the agent to fall back to `cd backend && python -m pytest` / `cd frontend && pnpm test`, paths that exist on two stacks out of six. It now uses `dude test`, which all six register.
- Stacks shipping Jira-driven skills lacked the `mcp__atlassian__*` permissions in `.claude/settings.json`, so those skills would prompt on every call.
