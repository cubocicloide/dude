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

/** ET003 — step-definitions files must have a matching feature file (no orphans) */
export default function check(root: string): RawDiagnostic[] {
  const featuresDir = path.join(root, 'e2e', 'features')
  const stepsDir = path.join(root, 'e2e', 'steps')

  if (!existsSync(stepsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const file of collectFiles(stepsDir, '.steps.ts')) {
    const stem = path.basename(file).replace(/\.steps\.ts$/, '')
    if (stem === 'common') continue // shared helpers are exempt

    if (existsSync(featuresDir)) {
      const matches = collectFiles(featuresDir, '.feature').filter(
        (f) => path.basename(f) === `${stem}.feature`,
      )
      if (matches.length === 0) {
        diagnostics.push({
          file: path.relative(root, file),
          line: 1,
          col: 1,
          severity: 'error',
          message: `Step file "${path.basename(file)}" has no matching feature. Expected: e2e/features/${stem}.feature`,
        })
      }
    }
  }

  return diagnostics
}
