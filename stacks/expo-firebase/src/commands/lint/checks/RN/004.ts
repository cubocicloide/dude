import { existsSync, readdirSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** RN004 — shared hook directories use the use<Name> convention. */
export default function check(root: string): RawDiagnostic[] {
  const dir = path.join(root, 'src', 'hooks')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !/^use[A-Z][A-Za-z0-9]*$/.test(entry.name))
    .map((entry) => ({
      file: path.join('src', 'hooks', entry.name),
      line: 1,
      col: 1,
      severity: 'error' as const,
      message: `Hook directory "${entry.name}" must use the use<Name> convention`,
    }))
}
