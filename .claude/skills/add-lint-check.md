# Skill: add-lint-check

Use this skill when asked to add a new lint check to the `react-fastapi` stack.

---

## Step 1 — Determine the next rule number

```bash
ls stacks/react-fastapi/src/commands/lint/checks/BE/
```

Pick the next unused three-digit number (e.g. `012`).

## Step 2 — Create the lint module

Create `stacks/react-fastapi/src/commands/lint/checks/BE/NNN.ts`:

```typescript
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { LintResult } from '../../../types.js'

// Describe what this rule checks in one line
export default async function check(projectRoot: string): Promise<LintResult[]> {
  const results: LintResult[] = []

  // ... your check logic ...

  return results
}
```

**`LintResult` shape:**
```typescript
interface LintResult {
  rule: string        // e.g. 'BE012'
  severity: 'error' | 'warning'
  message: string     // human-readable description
  file?: string       // relative path to the offending file (if applicable)
}
```

## Step 3 — Create the matching .claude rule

Create `stacks/react-fastapi/template/.claude/rules/BE/NNN.md` explaining:
- What the rule enforces
- Why it exists
- How to fix a violation
- Example of correct structure (if applicable)

## Step 4 — Rebuild and test

```bash
pnpm --filter @cubocicloide/stack-react-fastapi build
make dev-init
cd private/examples/test-local && dude lint
```

The new check must pass (exit 0) on a freshly scaffolded project.
Fix any template gaps before merging.

## Step 5 — Record a changeset

```bash
make changeset   # select 'patch' for new checks, 'minor' for breaking changes
```
