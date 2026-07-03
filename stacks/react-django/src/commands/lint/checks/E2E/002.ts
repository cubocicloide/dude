import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

function collectFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...collectFiles(full, ext))
    else if (entry.name.endsWith(ext)) results.push(full)
  }
  return results
}

/** ET002 — each feature file must have a matching step-definitions file */
export default function check(root: string): RawDiagnostic[] {
  const featuresDir = path.join(root, 'e2e', 'features')
  const stepsDir = path.join(root, 'e2e', 'steps')

  if (!existsSync(featuresDir) || !existsSync(stepsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const file of collectFiles(featuresDir, '.feature')) {
    const stem = path.basename(file).replace(/\.feature$/, '')
    const expected = path.join(stepsDir, `${stem}.steps.ts`)
    if (!existsSync(expected)) {
      diagnostics.push({
        file: path.relative(root, file),
        line: 1,
        col: 1,
        severity: 'error',
        message: `No step definitions for "${path.basename(file)}". Expected: e2e/steps/${stem}.steps.ts`,
      })
    }
  }

  return diagnostics
}
