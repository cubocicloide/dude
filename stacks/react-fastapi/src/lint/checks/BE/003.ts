import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, _sep, c: string) => c.toUpperCase())
}

/** BE003 — schemas/foo.py classes extending BaseModel/SQLModel must use the PascalCase prefix */
export default function check(root: string): RawDiagnostic[] {
  const schemasDir = path.join(root, 'backend', 'app', 'schemas')
  if (!existsSync(schemasDir)) return []

  const diagnostics: RawDiagnostic[] = []
  const classRe = /^class\s+(\w+)\s*\(.*(?:BaseModel|SQLModel)/gm

  for (const entry of readdirSync(schemasDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
    const expectedPrefix = snakeToPascal(entry.name.replace(/\.py$/, ''))
    const content = readFileSync(path.join(schemasDir, entry.name), 'utf8')
    for (const m of content.matchAll(classRe)) {
      const className = m[1]!
      if (!className.startsWith(expectedPrefix)) {
        diagnostics.push({
          file: path.join('backend', 'app', 'schemas', entry.name),
          line: 1,
          col: 1,
          severity: 'error',
          message: `Schema class "${className}" in ${entry.name} must start with "${expectedPrefix}"`,
        })
      }
    }
  }
  return diagnostics
}
