import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import {
  KEBAB_CASE,
  SCOPE_FILES,
  SCOPE_FILES_LABEL,
  diag,
  frontendSrc,
} from '../../frontend-structure'

const ALLOWED_DIRS = new Set(['$assets', '$misc'])

/** FE009 — utils/ is organised in kebab-case domain dirs, each with the scope files + $assets/$misc */
export default function check(root: string): RawDiagnostic[] {
  const utilsDir = path.join(frontendSrc(root), 'utils')
  if (!existsSync(utilsDir)) return []

  const results: RawDiagnostic[] = []

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)

      if (!entry.isDirectory()) {
        if (!SCOPE_FILES.has(entry.name)) {
          results.push(
            diag(
              root,
              entryPath,
              'warning',
              `Unexpected file "${entry.name}" in utils. Allowed: ${SCOPE_FILES_LABEL}`,
            ),
          )
        }
        continue
      }

      if (entry.name.startsWith('$')) {
        if (!ALLOWED_DIRS.has(entry.name)) {
          results.push(
            diag(
              root,
              entryPath,
              'error',
              `Unknown privileged directory "${entry.name}" in utils. Allowed: $assets/, $misc/`,
            ),
          )
        }
        continue
      }

      // Any other directory is a utils domain.
      if (!KEBAB_CASE.test(entry.name)) {
        results.push(
          diag(
            root,
            entryPath,
            'error',
            `Utils domain "${entry.name}" must be kebab-case (e.g. "date-helpers")`,
          ),
        )
      }
      if (!existsSync(path.join(entryPath, 'index.tsx'))) {
        results.push(
          diag(root, entryPath, 'error', `Utils domain "${entry.name}" is missing its index.tsx`),
        )
      }
      walk(entryPath)
    }
  }

  walk(utilsDir)
  return results
}
