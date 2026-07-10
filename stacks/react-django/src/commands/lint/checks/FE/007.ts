import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { HOOK_NAME, diag, findDirsNamed, frontendSrc } from '../../frontend-structure'

/** FE007 — every $hooks/ has an index.tsx barrel exporting all use* directories */
export default function check(root: string): RawDiagnostic[] {
  const results: RawDiagnostic[] = []

  for (const hooksDir of findDirsNamed(frontendSrc(root), '$hooks')) {
    const hookNames = readdirSync(hooksDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && HOOK_NAME.test(e.name))
      .map((e) => e.name)
    if (hookNames.length === 0) continue

    const barrelFile = path.join(hooksDir, 'index.tsx')
    if (!existsSync(barrelFile)) {
      results.push(
        diag(
          root,
          hooksDir,
          'error',
          `$hooks/ is missing its index.tsx barrel (must export: ${hookNames.join(', ')})`,
        ),
      )
      continue
    }

    const barrel = readFileSync(barrelFile, 'utf8')
    for (const name of hookNames) {
      if (!barrel.includes(`from './${name}'`) && !barrel.includes(`from "./${name}"`)) {
        results.push(
          diag(root, barrelFile, 'error', `$hooks/index.tsx is missing a barrel export for "${name}"`),
        )
      }
    }
  }
  return results
}
