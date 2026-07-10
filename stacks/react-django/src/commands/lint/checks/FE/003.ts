import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { PASCAL_CASE, diag, findDirsNamed, frontendSrc } from '../../frontend-structure'

/** FE003 — every $components/ has an index.tsx barrel exporting all component directories */
export default function check(root: string): RawDiagnostic[] {
  const results: RawDiagnostic[] = []

  for (const componentsDir of findDirsNamed(frontendSrc(root), '$components')) {
    const componentNames = readdirSync(componentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && PASCAL_CASE.test(e.name))
      .map((e) => e.name)
    if (componentNames.length === 0) continue

    const barrelFile = path.join(componentsDir, 'index.tsx')
    if (!existsSync(barrelFile)) {
      results.push(
        diag(
          root,
          componentsDir,
          'error',
          `$components/ is missing its index.tsx barrel (must export: ${componentNames.join(', ')})`,
        ),
      )
      continue
    }

    const barrel = readFileSync(barrelFile, 'utf8')
    for (const name of componentNames) {
      if (!barrel.includes(`from './${name}'`) && !barrel.includes(`from "./${name}"`)) {
        results.push(
          diag(
            root,
            barrelFile,
            'error',
            `$components/index.tsx is missing a barrel export for "${name}"`,
          ),
        )
      }
    }
  }
  return results
}
