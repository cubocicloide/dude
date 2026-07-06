---
'@cubocicloide/dude-launcher': patch
'@cubocicloide/dude': patch
'@cubocicloide/stack-fastmcp': patch
'@cubocicloide/stack-react-django': patch
'@cubocicloide/stack-react-fastapi': patch
'@cubocicloide/stack-tauri': patch
'@cubocicloide/stack-airflow': patch
---

fix(windows): make dude process execution reliable on win32

Windows needs `shell: true` for `spawnSync`/`execFileSync` to resolve
package-manager shims (`.cmd`/`.bat` — pnpm, npm, npx, uv) that aren't real
executables; without it, spawning them throws `ENOENT` even though the tool
is on PATH. Every stack command that shells out to a tool other than
`docker` (a real executable, unaffected) now opts into shell execution on
`win32` only, and reports `result.error` instead of silently treating a
failed spawn as a plain non-zero exit. `docs`'s browser launcher now uses
`cmd /c start` on Windows (bare `start` is a cmd.exe builtin, not a program).

Covers `dude-launcher` (pnpm/npx install), the CLI core (`dude upgrade`,
stack resolution/install), and the fastmcp, react-django, react-fastapi,
tauri and airflow stacks (docs, format, review, test, iac shared exec).
