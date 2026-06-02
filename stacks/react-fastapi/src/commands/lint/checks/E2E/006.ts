import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const REQUIRED_CONFIGS: Array<{ file: string; label: string }> = [
  { file: 'playwright.config.ts', label: 'Playwright' },
  { file: 'cucumber.js', label: 'Cucumber' },
]

/** ET006 — required e2e config files must be present */
export default function check(root: string): RawDiagnostic[] {
  const e2eDir = path.join(root, 'e2e')
  if (!existsSync(e2eDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const { file, label } of REQUIRED_CONFIGS) {
    if (!existsSync(path.join(e2eDir, file))) {
      diagnostics.push({
        file: path.join('e2e', file),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Missing ${label} config file: e2e/${file}`,
      })
    }
  }

  return diagnostics
}
