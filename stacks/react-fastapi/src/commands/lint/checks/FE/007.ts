import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const HOOK_DIR_RE = /^use[A-Z]/

/** FE007 — hooks/index.tsx must barrel-export all use* directories */
export default function check(root: string): RawDiagnostic[] {
  const hooksDir = path.join(root, 'frontend', 'src', 'hooks')
  const barrelFile = path.join(hooksDir, 'index.tsx')
  if (!existsSync(hooksDir) || !existsSync(barrelFile)) return []

  const hookDirs = readdirSync(hooksDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && HOOK_DIR_RE.test(e.name))
    .map((e) => e.name)

  const barrel = readFileSync(barrelFile, 'utf8')
  return hookDirs
    .filter((name) => !barrel.includes(`from './${name}'`) && !barrel.includes(`from "./${name}"`))
    .map((name) => ({
      file: path.join('frontend', 'src', 'hooks', 'index.tsx'),
      line: 1,
      col: 1,
      severity: 'error' as const,
      message: `hooks/index.tsx is missing a barrel export for "${name}"`,
    }))
}
