import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const ALLOWED = new Set(['index.tsx', 'styles.module.css', 'types.tsx', 'components'])

/** FE002 — component dirs may only contain index.tsx, styles.module.css, types.tsx, components/ */
export default function check(root: string): RawDiagnostic[] {
  const componentsDir = path.join(root, 'src', 'components')
  if (!existsSync(componentsDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    for (const child of readdirSync(path.join(componentsDir, entry.name), {
      withFileTypes: true,
    })) {
      if (!ALLOWED.has(child.name)) {
        diagnostics.push({
          file: path.join('src', 'components', entry.name, child.name),
          line: 1,
          col: 1,
          severity: 'warning',
          message: `Unexpected file "${child.name}" in component directory. Allowed: index.tsx, styles.module.css, types.tsx, components/`,
        })
      }
    }
  }
  return diagnostics
}
