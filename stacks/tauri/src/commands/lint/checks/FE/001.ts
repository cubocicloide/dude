import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/

/** FE001 — every directory inside components/ must be PascalCase */
export default function check(root: string): RawDiagnostic[] {
  const componentsDir = path.join(root, 'src', 'components')
  if (!existsSync(componentsDir)) return []

  return readdirSync(componentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => !PASCAL_CASE.test(e.name))
    .map((e) => ({
      file: path.join('src', 'components', e.name),
      line: 1,
      col: 1,
      severity: 'error' as const,
      message: `Component directory "${e.name}" must be PascalCase`,
    }))
}
