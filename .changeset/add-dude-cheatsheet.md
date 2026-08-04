---
'@cubocicloide/dude': minor
'@cubocicloide/stack-react-fastapi': minor
'@cubocicloide/stack-react-django': minor
'@cubocicloide/stack-fastmcp': minor
'@cubocicloide/stack-tauri': minor
'@cubocicloide/stack-frappe': minor
'@cubocicloide/stack-airflow': minor
---

Add `dude cheatsheet` — one dense, answer-aware reference for the project you are
standing in: how it was scaffolded, the verify loop (only steps this project
actually has), every lint rule with its one-line title, the top-level layout, and
the full command catalog. Everything is derived from the live catalog and the
project's own `.claude/rules/` files, so it stays correct as init answers, stack
versions and project-local commands change.

`--format json` emits the same data with a `dude.cheatsheet/1` schema marker and
the command catalog embedded, so a coding agent gets what it may run and what will
be checked in a single fetch instead of crawling a documentation site.

The renderer lives in the CLI (`generateCheatsheet`) and every stack registers the
shared command with `defineCheatsheetCommand()`, mirroring `defineLintCommand()` —
never hand-roll a per-stack cheatsheet.
