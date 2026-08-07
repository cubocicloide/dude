# Project lint checks

Drop a file in this directory and it becomes a lint rule that `dude lint` runs
alongside the stack's built-in checks. The rule's code is derived from the
path:

```
.dude/lint/checks/PRJ/001.ts   →   PRJ001
.dude/lint/checks/SEC/002.ts   →   SEC002
```

No registration step — this directory **is** the registry (groups are the
sub-directories, ids are the file names).

## Writing a check

Each file must `export default` a function that receives the project root and
returns diagnostics (synchronously or as a Promise). Use the types from
`@cubocicloide/dude` (already a dev dependency of this project):

```ts
// .dude/lint/checks/PRJ/001.ts
import type { RawDiagnostic } from '@cubocicloide/dude'

export default function check(root: string): RawDiagnostic[] {
  return [
    // {
    //   file: 'backend/app/main.py', // path relative to the project root
    //   line: 1,
    //   col: 1,
    //   severity: 'error',           // 'error' fails the build; 'warning' doesn't
    //   message: 'What is wrong and how to fix it.',
    // },
  ]
}
```

Checks are loaded with [jiti](https://github.com/unjs/jiti), so you can write
real TypeScript and `import` any package you add to the project.

## Documenting a rule

Put a Markdown file next to the check, named after it:

```
.dude/lint/checks/PRJ/001.ts   ← the rule
.dude/lint/checks/PRJ/001.md   ← what it means and how to fix it
```

`dude explain PRJ001` prints that file, and `dude cheatsheet` uses its first
heading (`# PRJ001 — <title>`) as the rule's one-line title. Without it the rule
still runs, but it can only be reported as a bare code — which tells whoever hits
the diagnostic nothing about how to fix it. The shipped `PRJ/001.md` is a worked
example.

`dude lint` ignores non-module files, so the Markdown never runs as a check.
Co-located tests (`001.test.ts`) are ignored too.

> Stack rules use the mirror-image location, `.claude/rules/<GROUP>/<NNN>.md`.
> `dude explain <CODE>` serves both.

## Choosing codes

Use your own groups (e.g. `PRJ`, `SEC`, your project's initials). A code
already claimed by the stack (e.g. `BE001`) is a **hard error** — project
checks extend the stack's rule set, they never shadow it.

## Disabling a stack rule

To drop a built-in rule, list its code in `dude.json`:

```json
{
  "lint": { "disable": ["BE003"] }
}
```

To *replace* a stack rule, disable it and add your adapted version under a
project-owned code (e.g. `PRJ/001.ts`).

## Running

```bash
dude lint          # stack checks + project checks, minus disabled codes
dude lint --quiet  # errors only
```
