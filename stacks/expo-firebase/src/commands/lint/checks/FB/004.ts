import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** FB004 — Firebase configuration and non-open Firestore rules are required. */
export default function check(root: string): RawDiagnostic[] {
  const required = ['firebase.json', 'firestore.rules', 'firestore.indexes.json']
  const diagnostics: RawDiagnostic[] = required
    .filter((file) => !existsSync(path.join(root, file)))
    .map((file) => ({
      file,
      line: 1,
      col: 1,
      severity: 'error' as const,
      message: `Required Firebase file is missing: ${file}`,
    }))
  const rulesFile = path.join(root, 'firestore.rules')
  if (
    existsSync(rulesFile) &&
    /allow\s+(?:read,\s*write|read|write)\s*:\s*if\s+true\s*;/.test(readFileSync(rulesFile, 'utf8'))
  ) {
    diagnostics.push({
      file: 'firestore.rules',
      line: 1,
      col: 1,
      severity: 'error',
      message: 'Firestore rules must never contain an unconditional allow rule',
    })
  }
  return diagnostics
}
