import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, _sep, c: string) => c.toUpperCase())
}

/**
 * BE011 — every class in a `queries/` file must be named with the PascalCase
 * prefix derived from the filename. Multiple classes are allowed.
 *
 *   queries/todos.py  → Todos, TodosList, TodosDelete, … are all valid
 *   queries/users.py  → Users, UsersCreate, UsersById, …
 *
 * Rules:
 *   - Error if the file defines no classes at all
 *   - Error for each class whose name does not start with the expected prefix
 */
export default function check(root: string): RawDiagnostic[] {
  const queriesDir = path.join(root, 'backend', 'app', 'queries')
  if (!existsSync(queriesDir)) return []

  const diagnostics: RawDiagnostic[] = []
  const classRe = /^class\s+(\w+)/gm

  for (const entry of readdirSync(queriesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue

    const stem = entry.name.replace(/\.py$/, '')
    const expectedPrefix = snakeToPascal(stem)
    const relPath = path.join('backend', 'app', 'queries', entry.name)
    const content = readFileSync(path.join(queriesDir, entry.name), 'utf8')

    const classes = [...content.matchAll(classRe)].map((m) => m[1]!)

    if (classes.length === 0) {
      diagnostics.push({
        file: relPath,
        line: 1,
        col: 1,
        severity: 'error',
        message: `queries/${entry.name} defines no classes — expected at least one class starting with \`${expectedPrefix}\``,
      })
      continue
    }

    for (const cls of classes) {
      if (!cls.startsWith(expectedPrefix)) {
        diagnostics.push({
          file: relPath,
          line: 1,
          col: 1,
          severity: 'error',
          message: `class \`${cls}\` in queries/${entry.name} must start with \`${expectedPrefix}\` (e.g. \`${expectedPrefix}\`, \`${expectedPrefix}List\`, \`${expectedPrefix}Delete\`)`,
        })
      }
    }
  }

  return diagnostics
}
