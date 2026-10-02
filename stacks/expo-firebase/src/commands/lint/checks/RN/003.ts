import { existsSync, readdirSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const PASCAL = /^[A-Z][A-Za-z0-9]*$/

/** RN003 — shared component directories are PascalCase and barrel-exported. */
export default function check(root: string): RawDiagnostic[] {
  const dir = path.join(root, 'src', 'components')
  if (!existsSync(dir)) return []
  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!PASCAL.test(entry.name)) {
      diagnostics.push({
        file: path.join('src', 'components', entry.name),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Component directory "${entry.name}" must be PascalCase`,
      })
    }
    if (!existsSync(path.join(dir, entry.name, 'index.tsx'))) {
      diagnostics.push({
        file: path.join('src', 'components', entry.name, 'index.tsx'),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Component "${entry.name}" needs an index.tsx barrel`,
      })
    }
  }
  return diagnostics
}
