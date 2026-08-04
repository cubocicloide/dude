---
'@cubocicloide/dude': minor
'@cubocicloide/stack-react-fastapi': patch
'@cubocicloide/stack-react-django': patch
'@cubocicloide/stack-fastmcp': patch
'@cubocicloide/stack-tauri': patch
'@cubocicloide/stack-frappe': patch
'@cubocicloide/stack-airflow': patch
---

Fix two correctness bugs found reviewing the docs-composition work.

**A stack newer than the running CLI now fails legibly.** A stack's module body
calls the CLI's `define*Command()` helpers while building its `commands` map, so it
throws while being *imported* — before `minDudeVersion` can be read, and for every
command rather than only the one needing the new API. Previously that surfaced as a
raw Node stack trace. `cli.ts` now catches the load failure and explains it, and
core commands (`version`, `upgrade`, `info`) fall through and keep working, since
`dude upgrade --cli` is the way out of exactly this situation.

**`dude cheatsheet` no longer reports disabled rules as enforced.** It read
`.claude/rules/` directly and ignored `dude.json` → `lint.disable`, which the lint
engine honours — so a project that switched a code off still saw it listed under
"rules `dude lint` runs". Disabled codes are now excluded and stated in their own
section, project-local checks under `.dude/lint/checks/` are included (they run but
ship no prose file), and each rule says which source it came from.

Also: the core command registry is now defined once (`coreCommands`) and drives
citty's dispatch, the published catalog and the tests, instead of two
hand-maintained lists that had already drifted; `catalogToMarkdown` takes a
`standalone` option instead of being string-spliced by its caller; a malformed
`dude.json` produces a warning instead of a silently truncated page; and the
catalog is resolved once per render rather than two or three times.
