---
'@cubocicloide/dude': minor
'@cubocicloide/stack-airflow': minor
'@cubocicloide/stack-fastmcp': minor
'@cubocicloide/stack-frappe': minor
'@cubocicloide/stack-react-django': minor
'@cubocicloide/stack-react-fastapi': minor
'@cubocicloide/stack-tauri': minor
---

Project-defined lint rules, uniform across every stack.

- `dude lint` now also runs project checks from `.dude/lint/checks/<GROUP>/<id>.ts`
  (loaded via jiti — real TypeScript, project imports allowed), under the same
  `CheckFn` contract stack checks use; the rule code is derived from the path.
- A code defined twice (stack + project, or twice in the project) is a hard
  error; stack rules can be disabled per-project via `dude.json` →
  `lint.disable: ["BE003", …]` (unknown codes produce a notice).
- New `defineLintCommand()` export in `@cubocicloide/dude`; all stacks now
  register their `lint` command through it instead of hand-rolled wrappers
  (the stacks' peer range on `@cubocicloide/dude` moves to `^0.12.0`
  accordingly — upgrade both pins together with `dude upgrade`).
- Scaffolds ship a `.dude/lint/checks/` README + `PRJ/001.ts` starter example,
  and the generated docs describe project lint rules.
