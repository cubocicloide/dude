---
applyTo: "stacks/**"
---

# Lint checks and .claude rule parity

Every lint check module must have a matching prose description file in the
template so that generated projects understand why a check exists and how to
fix violations.

## Mapping

| Lint module (source)                  | Claude rule (template)              |
| ------------------------------------- | ----------------------------------- |
| `src/commands/lint/checks/BE/NNN.ts`  | `template/.claude/rules/BE/NNN.md`  |
| `src/commands/lint/checks/FE/NNN.ts`  | `template/.claude/rules/FE/NNN.md`  |
| `src/commands/lint/checks/E2E/NNN.ts` | `template/.claude/rules/E2E/NNN.md` |

## Invariant

When you **add** a lint check → add the matching `.claude/rules` file.
When you **change** what a lint check enforces → update the `.claude/rules` file.
When you **remove** a lint check → remove the `.claude/rules` file.

Violations of this rule make the generated `.claude` guidance stale and
mislead Claude when working inside scaffolded projects.

## Check file structure

```typescript
// src/commands/lint/checks/BE/NNN.ts
import type { LintResult } from '../../../types.js'

export default function check(projectRoot: string): LintResult[] {
  const results: LintResult[] = []
  // ... check logic ...
  return results
}
```

The function must be the default export and must return `LintResult[]`.
No registration step is needed — modules are auto-discovered.
