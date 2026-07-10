import { existsSync, readdirSync } from 'node:fs'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { diag, findDirsNamed, frontendSrc } from '../../frontend-structure'

/** FE011 — discourage $misc: it is exempt from structure checks, but flag every use of it */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = frontendSrc(root)
  if (!existsSync(srcDir)) return []

  return findDirsNamed(srcDir, '$misc').map((miscDir) => {
    const count = readdirSync(miscDir).length
    return diag(
      root,
      miscDir,
      'warning',
      `Avoid $misc (${count} ${count === 1 ? 'entry' : 'entries'}) — it is a temporary escape hatch. Relocate its content: components → $components/, hooks → $hooks/, shared types → types.tsx, pure functions → functions.tsx, constants → constants.tsx, static files → $assets/`,
    )
  })
}
