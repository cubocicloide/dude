---
'@cubocicloide/stack-react-fastapi': patch
'@cubocicloide/stack-react-django': patch
'@cubocicloide/stack-fastmcp': patch
'@cubocicloide/stack-airflow': patch
'@cubocicloide/stack-frappe': patch
'@cubocicloide/stack-tauri': patch
---

Drop the redundant `peerDependencies` on `@cubocicloide/dude` from every stack. It duplicated the `devDependencies` pin and served no functional purpose (scaffolded projects pin `dude` directly; runtime compatibility is enforced by `minDudeVersion`). The `workspace:^` form also triggered a Changesets bug that forced a spurious **major** bump on every stack whenever `dude` was released; with the peer entry gone, a `dude` release no longer re-versions the stacks at all.
