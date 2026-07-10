import { readdirSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { PASCAL_CASE, diag, findDirsNamed, frontendSrc } from '../../frontend-structure'

/** FE001 — every directory inside any $components/ must be PascalCase */
export default function check(root: string): RawDiagnostic[] {
  const results: RawDiagnostic[] = []

  for (const componentsDir of findDirsNamed(frontendSrc(root), '$components')) {
    for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const full = path.join(componentsDir, entry.name)
      if (entry.name.startsWith('$')) {
        results.push(
          diag(
            root,
            full,
            'error',
            `Privileged directory "${entry.name}" is not allowed directly inside $components/ — it belongs inside a component directory`,
          ),
        )
      } else if (!PASCAL_CASE.test(entry.name)) {
        results.push(
          diag(root, full, 'error', `Component directory "${entry.name}" must be PascalCase`),
        )
      }
    }
  }
  return results
}
