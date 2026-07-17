---
'@cubocicloide/dude': minor
---

Add a core `dude info` command that prints an environment diagnostics report — OS, Node/pnpm/Docker versions, resolved CLI + stack versions, and the recorded scaffold answers — as a copy-pasteable block. Intended to be pasted into bug reports so triage has the environment context up front. Named `info` (not `doctor`) so it never shadows a stack's own `doctor` health-check command (e.g. the tauri stack). The command is listed in `dude help` and works both inside and outside a project.
