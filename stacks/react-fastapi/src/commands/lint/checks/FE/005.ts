import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const ALLOWED = new Set(['index.tsx', 'styles.module.css', 'types.tsx'])

/** FE005 — page dirs may only contain index.tsx, styles.module.css, types.tsx */
export default function check(root: string): RawDiagnostic[] {
  const pagesDir = path.join(root, 'frontend', 'src', 'pages')
  if (!existsSync(pagesDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(pagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    for (const child of readdirSync(path.join(pagesDir, entry.name), { withFileTypes: true })) {
      if (!ALLOWED.has(child.name)) {
        diagnostics.push({
          file: path.join('frontend', 'src', 'pages', entry.name, child.name),
          line: 1,
          col: 1,
          severity: 'warning',
          message: `Unexpected file "${child.name}" in page directory. Allowed: index.tsx, styles.module.css, types.tsx`,
        })
      }
    }
  }
  return diagnostics
}
