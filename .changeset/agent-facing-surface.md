---
'@cubocicloide/stack-react-fastapi': minor
'@cubocicloide/stack-react-django': minor
'@cubocicloide/stack-fastmcp': minor
'@cubocicloide/stack-tauri': minor
'@cubocicloide/stack-frappe': minor
'@cubocicloide/stack-airflow': minor
---

Give coding agents a real entry point in every scaffolded project.

- **`AGENTS.md`** — a thin pointer for non-Claude agents: ask the project what it
  is with `dude cheatsheet --format json`, read the conventions in `CLAUDE.md` and
  `.claude/rules/`, then verify with `dude lint` and `dude test`. Deliberately a
  pointer rather than a second copy of the guidance, because duplicated
  instructions drift.
- **`CLAUDE.md`** now opens with the cheatsheet: one call returns the project's
  live command catalog, every lint rule, the verify loop and the init answers, so
  an agent should prefer it over any hand-written command list in the file.

Both lean on the same idea: this project's conventions are enforced mechanically,
so an agent can check its own output rather than guess.
