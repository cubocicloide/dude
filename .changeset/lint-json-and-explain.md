---
'@cubocicloide/dude': minor
'@cubocicloide/stack-react-fastapi': minor
'@cubocicloide/stack-react-django': minor
'@cubocicloide/stack-fastmcp': minor
'@cubocicloide/stack-tauri': minor
'@cubocicloide/stack-frappe': minor
'@cubocicloide/stack-airflow': minor
---

Add `dude lint --format json` and `dude explain <CODE>`.

`dude lint --format json` emits the diagnostics that were always structured
internally and only ever printed as prose:
`{ schema, diagnostics, errorCount, warningCount, notices }`, and nothing else on
stdout, so it pipes. Exit codes are unchanged, and `--quiet` composes (it filters
the listing; the counts stay the true totals, as in the human format).

`dude explain <CODE>` prints the prose behind a rule — `.claude/rules/<GROUP>/<NNN>.md`
for a stack rule, or the sibling `.dude/lint/checks/<GROUP>/<NNN>.md` for a project
rule, the convention the scaffolded contract already advertised but nothing read.
With no code it lists every rule that applies to the current project.

Also in this change:

- Stack commands can declare `type: 'positional'` arguments, and the dispatcher
  binds them. Bare words were previously parsed and dropped, so a positional
  could never reach a command's `run`.
- `dude cheatsheet` now resolves project-rule titles through the same lookup as
  `explain`, instead of degrading every project rule to a bare code.
- Every stack template ships `.dude/lint/checks/PRJ/001.md` beside its example
  check, so the documented pairing has a worked example.
