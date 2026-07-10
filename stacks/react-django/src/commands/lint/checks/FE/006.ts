import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import {
  HOOK_NAME,
  SCOPE_FILES,
  SCOPE_FILES_LABEL,
  diag,
  findDirsNamed,
  frontendSrc,
} from '../../frontend-structure'

const ALLOWED_DIRS = new Set(['$assets', '$misc'])

/** FE006 — $hooks/ holds use* dirs; each hook dir has index.tsx + scope files + $assets/$misc */
export default function check(root: string): RawDiagnostic[] {
  const results: RawDiagnostic[] = []

  for (const hooksDir of findDirsNamed(frontendSrc(root), '$hooks')) {
    for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const hookDir = path.join(hooksDir, entry.name)

      if (entry.name.startsWith('$')) {
        results.push(
          diag(
            root,
            hookDir,
            'error',
            `Privileged directory "${entry.name}" is not allowed directly inside $hooks/ — it belongs inside a hook directory`,
          ),
        )
        continue
      }
      if (!HOOK_NAME.test(entry.name)) {
        results.push(
          diag(
            root,
            hookDir,
            'error',
            `Hook directory "${entry.name}" must match use[A-Z]… (e.g. useAttachments)`,
          ),
        )
        continue
      }

      if (!existsSync(path.join(hookDir, 'index.tsx'))) {
        results.push(
          diag(root, hookDir, 'error', `Hook "${entry.name}" is missing its index.tsx`),
        )
      }

      for (const child of readdirSync(hookDir, { withFileTypes: true })) {
        const childPath = path.join(hookDir, child.name)
        if (child.isDirectory()) {
          if (!ALLOWED_DIRS.has(child.name)) {
            results.push(
              diag(
                root,
                childPath,
                'error',
                `Unexpected directory "${child.name}" in hook directory. Allowed: $assets/, $misc/`,
              ),
            )
          }
        } else if (!SCOPE_FILES.has(child.name)) {
          results.push(
            diag(
              root,
              childPath,
              'error',
              `Unexpected file "${child.name}" in hook directory. Allowed: ${SCOPE_FILES_LABEL}`,
            ),
          )
        }
      }
    }
  }
  return results
}
