import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const ALLOWED = new Set(['index.tsx', 'types.tsx'])
const HOOK_DIR_RE = /^use[A-Z]/

/** FE006 — use* dirs in hooks/ may only contain index.tsx and types.tsx */
export default function check(root: string): RawDiagnostic[] {
  const hooksDir = path.join(root, 'frontend', 'src', 'hooks')
  if (!existsSync(hooksDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !HOOK_DIR_RE.test(entry.name)) continue
    for (const child of readdirSync(path.join(hooksDir, entry.name), { withFileTypes: true })) {
      if (!ALLOWED.has(child.name)) {
        diagnostics.push({
          file: path.join('frontend', 'src', 'hooks', entry.name, child.name),
          line: 1,
          col: 1,
          severity: 'warning',
          message: `Unexpected file "${child.name}" in hook directory. Allowed: index.tsx, types.tsx`,
        })
      }
    }
  }
  return diagnostics
}
