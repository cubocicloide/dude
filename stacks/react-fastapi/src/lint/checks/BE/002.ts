import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, _sep, c: string) => c.toUpperCase())
}

/** BE002 — models/foo.py must define `class Foo` (snake_case → PascalCase) */
export default function check(root: string): RawDiagnostic[] {
  const modelsDir = path.join(root, 'backend', 'app', 'models')
  if (!existsSync(modelsDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(modelsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
    const expectedClass = snakeToPascal(entry.name.replace(/\.py$/, ''))
    const content = readFileSync(path.join(modelsDir, entry.name), 'utf8')
    if (!new RegExp(`class\\s+${expectedClass}\\b`).test(content)) {
      diagnostics.push({
        file: path.join('backend', 'app', 'models', entry.name),
        line: 1,
        col: 1,
        severity: 'error',
        message: `models/${entry.name} must define \`class ${expectedClass}\``,
      })
    }
  }
  return diagnostics
}
