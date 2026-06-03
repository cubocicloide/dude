# Skill: add-lint-check

Use this skill when asked to add a new lint check to a stack.

---

## Step 0 — Identify stack and group

Lint checks are **per-stack** and **per-group**. Confirm both before continuing:

| Question | Options |
|----------|---------|
| Which stack? | `react-fastapi` (only stack today; future stacks live under `stacks/<name>/`) |
| Which group? | `BE` (backend), `FE` (frontend), `E2E` (end-to-end) |

The group determines:
- Where the module lives: `stacks/<stack>/src/commands/lint/checks/<GROUP>/`
- Where the Claude rule goes: `stacks/<stack>/template/.claude/rules/<GROUP>/`
- What prefix the rule ID carries: `BE001`, `FE001`, `E2E001`, …

---

## Step 1 — Determine the next rule number

```bash
ls stacks/<stack>/src/commands/lint/checks/<GROUP>/
```

Pick the next unused three-digit number within that group (BE, FE, and E2E
each have their own independent numbering sequence).

---

## Step 2 — Create the lint module

Path: `stacks/<stack>/src/commands/lint/checks/<GROUP>/NNN.ts`

```typescript
import { existsSync, readdirSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** <GROUP>NNN — one-line description of what this rule enforces */
export default function check(root: string): RawDiagnostic[] {
  const results: RawDiagnostic[] = []

  // ... check logic ...

  return results
}
```

**`RawDiagnostic` shape** (from `@cubocicloide/dude`):

```typescript
interface RawDiagnostic {
  rule: string        // e.g. 'BE012', 'FE003', 'E2E001'
  severity: 'error' | 'warning'
  message: string     // human-readable; include the offending value if useful
  file?: string       // workspace-relative path (e.g. 'backend/app/models/user.py')
}
```

**Group-specific conventions:**

| Group | `root`-relative starting path | Typical checks |
|-------|-------------------------------|----------------|
| `BE` | `backend/app/` | directory structure, file naming, import patterns, test coverage |
| `FE` | `frontend/src/` | component naming, hook naming, import ordering |
| `E2E` | `e2e/` | feature file naming, step file naming, tag conventions |

The function **must** be the default export and **must** return `RawDiagnostic[]`.
No registration step is needed — modules are auto-discovered by the build.

---

## Step 3 — Create the matching .claude rule

Path: `stacks/<stack>/template/.claude/rules/<GROUP>/NNN.md`

Content must cover:
1. What the rule enforces and why
2. How to fix a violation (concrete example)
3. Correct structure / naming pattern (code block or table)

---

## Step 4 — Rebuild and test

```bash
# 1. Rebuild the stack
pnpm --filter @cubocicloide/stack-react-fastapi build

# 2. Scaffold a fresh project (add options that exercise the new check)
make dev-init
# or: make dev-init STACK_OPTS="--database postgres --celery --celerybeat"

# 3. Run lint — must exit 0 with no errors
cd private/examples/test-local
dude lint
```

If the new check flags something in the fresh scaffold, fix the template **before**
merging (the generated project must be lint-clean out of the box).

---

## Step 5 — Record a changeset

```bash
make changeset
# → 'patch' for a new check that does not break existing projects
# → 'minor' for a check that requires changes in already-scaffolded projects
```
