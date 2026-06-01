import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, _sep, c: string) => c.toUpperCase())
}

/**
 * BE003 — every class in a schemas file must:
 *   1. extend BaseModel or SQLModel (it must be a Pydantic/SQLModel schema)
 *   2. be named with the PascalCase prefix derived from the filename
 *      (foo.py → Foo, todo_item.py → TodoItem)
 */
export default function check(root: string): RawDiagnostic[] {
  const schemasDir = path.join(root, 'backend', 'app', 'schemas')
  if (!existsSync(schemasDir)) return []

  const diagnostics: RawDiagnostic[] = []
  // Matches any class definition; captures name and optional base list
  const classRe = /^class\s+(\w+)(?:\s*\(([^)]*)\))?/gm

  for (const entry of readdirSync(schemasDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
    const expectedPrefix = snakeToPascal(entry.name.replace(/\.py$/, ''))
    const relPath = path.join('backend', 'app', 'schemas', entry.name)
    const content = readFileSync(path.join(schemasDir, entry.name), 'utf8')

    for (const m of content.matchAll(classRe)) {
      const className = m[1]!
      const bases = m[2] ?? ''
      const isSchema = /BaseModel|SQLModel/.test(bases)

      if (!isSchema) {
        diagnostics.push({
          file: relPath, line: 1, col: 1, severity: 'error',
          message: `class \`${className}\` in ${entry.name} must extend BaseModel (or SQLModel) — only Pydantic schemas are allowed in schemas/`,
        })
      }

      if (!className.startsWith(expectedPrefix)) {
        diagnostics.push({
          file: relPath, line: 1, col: 1, severity: 'error',
          message: `schema class \`${className}\` in ${entry.name} must start with \`${expectedPrefix}\``,
        })
      }
    }
  }
  return diagnostics
}
