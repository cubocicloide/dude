import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import {
  PASCAL_CASE,
  SCOPE_FILES,
  SCOPE_FILES_LABEL,
  diag,
  findDirsNamed,
  frontendSrc,
} from '../../frontend-structure'

const ALLOWED_DIRS = new Set(['$components', '$hooks', '$assets', '$misc'])

/** FE002 — component dirs contain only the scope files and $components/$hooks/$assets/$misc */
export default function check(root: string): RawDiagnostic[] {
  const results: RawDiagnostic[] = []

  for (const componentsDir of findDirsNamed(frontendSrc(root), '$components')) {
    for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !PASCAL_CASE.test(entry.name)) continue
      const componentDir = path.join(componentsDir, entry.name)

      if (!existsSync(path.join(componentDir, 'index.tsx'))) {
        results.push(
          diag(root, componentDir, 'error', `Component "${entry.name}" is missing its index.tsx`),
        )
      }

      for (const child of readdirSync(componentDir, { withFileTypes: true })) {
        const childPath = path.join(componentDir, child.name)
        if (child.isDirectory()) {
          if (!ALLOWED_DIRS.has(child.name)) {
            results.push(
              diag(
                root,
                childPath,
                'error',
                `Unexpected directory "${child.name}" in component directory. Allowed: $components/, $hooks/, $assets/, $misc/`,
              ),
            )
          }
        } else if (!SCOPE_FILES.has(child.name)) {
          results.push(
            diag(
              root,
              childPath,
              'error',
              `Unexpected file "${child.name}" in component directory. Allowed: ${SCOPE_FILES_LABEL}`,
            ),
          )
        }
      }
    }
  }
  return results
}
