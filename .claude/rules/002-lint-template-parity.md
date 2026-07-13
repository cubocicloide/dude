---
paths:
  - "stacks/**"
---

# Lint checks — contract and .claude rule parity

## The uniform lint contract

All lint rules — stack-shipped **and** project-defined — follow one contract,
enforced by the shared engine in `packages/dude/src/core/lint/`:

- One file per rule at `checks/<GROUP>/<id>.ts`; the diagnostic code is
  derived from the path (`checks/FE/001.ts` → `FE001`). No registration step —
  modules are auto-discovered.
- The module default-exports a `CheckFn` from `@cubocicloide/dude`:

```typescript
// src/commands/lint/checks/BE/NNN.ts
import type { RawDiagnostic } from '@cubocicloide/dude'

export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  // ... check logic; may also be async and return Promise<RawDiagnostic[]>
  return diagnostics
}
```

- Stack checks are discovered from the **built** stack at
  `dist/commands/lint/checks/`; project checks from the scaffolded project's
  `.dude/lint/checks/` (loaded via jiti, TS allowed).
- A code defined twice (stack + project, or twice in the project) is a hard
  error. Projects disable a stack rule via `dude.json` → `lint.disable`.
- Every stack registers the command with `defineLintCommand()` from
  `@cubocicloide/dude` — never hand-roll a per-stack lint command wrapper.

## Parity invariant

Every stack lint check must have a matching prose description in the template
so generated projects understand why a check exists and how to fix violations:

| Lint module (source)                    | Claude rule (template)                      |
| --------------------------------------- | ------------------------------------------- |
| `src/commands/lint/checks/<GRP>/NNN.ts` | `templates/base/.claude/rules/<GRP>/NNN.md` |

When you **add** a lint check → add the matching `.claude/rules` file.
When you **change** what a lint check enforces → update the `.claude/rules` file.
When you **remove** a lint check → remove the `.claude/rules` file.

Violations of this rule make the generated `.claude` guidance stale and
mislead Claude when working inside scaffolded projects.

Project-defined checks follow the same spirit: an optional Markdown file
co-located with the check (`.dude/lint/checks/PRJ/001.md`) documents the rule;
the engine ignores non-module files.
