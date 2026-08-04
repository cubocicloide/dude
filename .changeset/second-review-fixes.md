---
'@cubocicloide/dude': minor
'@cubocicloide/stack-react-fastapi': patch
'@cubocicloide/stack-react-django': patch
'@cubocicloide/stack-fastmcp': patch
'@cubocicloide/stack-tauri': patch
'@cubocicloide/stack-frappe': patch
'@cubocicloide/stack-airflow': patch
---

Fix four defects found reviewing the previous round of fixes.

**`dude init` no longer dumps a stack trace when the stack is newer than the CLI.**
The earlier guard only covered commands run inside an existing project; `init`
resolves the stack itself, and that is the path every *new* project takes. Since
promotion to `latest` is per-package, a stack promoted before the CLI reproduced
this for real users. The version-skew advice is also now offered **conditionally** —
appending it to every failure told people to run `dude upgrade --cli` right after
the loader had correctly told them to build the stack.

**A malformed `dude.json` is explained instead of crashing.** The dispatcher parsed
it unguarded, so *every* command in such a project died with a raw `SyntaxError`,
including the ones needed to fix it. `readDisabledCodes` had the same hole.

**`dude cheatsheet` now derives the enforced rule set from the lint engine itself**
(`discoverCheckCodes`), not from the project's `.claude/rules/` prose directory.
Those are two independently-mutable trees, so the page could omit a rule that runs
(stale prose after `dude upgrade --stack`) or invent one that does not (leftover
prose), and its own copy of the loadable-extension list had already lost `.mts`.
Rule files now supply only titles. A stack/project code collision — which makes
`runLint` refuse to run at all — is reported instead of silently resolved.

**The composer validates its own tables.** Escaping there had been wrong three
times; the check now fails the build on a row whose cell count does not match its
header, or on a value escaped twice.
