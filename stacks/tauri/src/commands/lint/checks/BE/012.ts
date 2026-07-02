import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { readText } from '../../helpers.js'

/**
 * BE012 — lib.rs must keep the mobile entry point on run().
 * `#[cfg_attr(mobile, tauri::mobile_entry_point)]` is what lets the same
 * run() serve iOS/Android builds (`dude android|ios *`). It is a no-op on
 * desktop, so there is never a reason to remove it — but removing it breaks
 * mobile builds silently, at link time.
 */
export default function check(root: string): RawDiagnostic[] {
  const libFile = path.join(root, 'src-tauri', 'src', 'lib.rs')
  if (!existsSync(libFile)) return []

  const content = readText(libFile)
  if (content.includes('mobile_entry_point')) return []

  return [
    {
      file: path.join('src-tauri', 'src', 'lib.rs'),
      line: 1,
      col: 1,
      severity: 'error',
      message:
        'run() has lost its #[cfg_attr(mobile, tauri::mobile_entry_point)] attribute — required for iOS/Android builds, harmless on desktop. Restore it.',
    },
  ]
}
