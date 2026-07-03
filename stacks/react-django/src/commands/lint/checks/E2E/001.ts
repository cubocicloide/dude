import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/

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

/** ET001 — feature file names must be snake_case */
export default function check(root: string): RawDiagnostic[] {
  const featuresDir = path.join(root, 'e2e', 'features')
  const diagnostics: RawDiagnostic[] = []

  for (const file of collectFiles(featuresDir, '.feature')) {
    const stem = path.basename(file).replace(/\.feature$/, '')
    if (!SNAKE_CASE.test(stem)) {
      diagnostics.push({
        file: path.relative(root, file),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Feature file "${path.basename(file)}" must use snake_case (got "${stem}").`,
      })
    }
  }

  return diagnostics
}
