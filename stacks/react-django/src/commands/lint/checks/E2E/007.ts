import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const HARDCODED_URL_RE = /https?:\/\//

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

/** ET007 — step files must not contain hardcoded URLs (use this.baseUrl from CustomWorld) */
export default function check(root: string): RawDiagnostic[] {
  const stepsDir = path.join(root, 'e2e', 'steps')
  if (!existsSync(stepsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const file of collectFiles(stepsDir, '.steps.ts')) {
    let lines: string[]
    try {
      lines = readFileSync(file, 'utf8').split('\n')
    } catch {
      continue
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line === undefined) continue
      const stripped = line.trim()
      if (stripped.startsWith('//') || stripped.startsWith('*')) continue
      if (HARDCODED_URL_RE.test(line)) {
        diagnostics.push({
          file: path.relative(root, file),
          line: i + 1,
          col: 1,
          severity: 'warning',
          message: `Hardcoded URL detected. Use this.baseUrl from CustomWorld instead.`,
        })
      }
    }
  }

  return diagnostics
}
