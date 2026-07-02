import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/

/** FE003 — components/index.tsx must barrel-export all PascalCase child directories */
export default function check(root: string): RawDiagnostic[] {
  const componentsDir = path.join(root, 'src', 'components')
  const barrelFile = path.join(componentsDir, 'index.tsx')
  if (!existsSync(componentsDir) || !existsSync(barrelFile)) return []

  const pascalDirs = readdirSync(componentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && PASCAL_CASE.test(e.name))
    .map((e) => e.name)

  const barrel = readFileSync(barrelFile, 'utf8')
  return pascalDirs
    .filter((name) => !barrel.includes(`from './${name}'`) && !barrel.includes(`from "./${name}"`))
    .map((name) => ({
      file: path.join('src', 'components', 'index.tsx'),
      line: 1,
      col: 1,
      severity: 'error' as const,
      message: `components/index.tsx is missing a barrel export for "${name}"`,
    }))
}
