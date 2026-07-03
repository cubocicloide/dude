import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const SECRET_KEY_RE = /^\s*SECRET_KEY\s*=\s*(["'])/
const DEBUG_TRUE_RE = /^\s*DEBUG\s*=\s*True\b/

/** BE007 — settings hygiene: no literal SECRET_KEY, no DEBUG = True (local.py exempt) */
export default function check(root: string): RawDiagnostic[] {
  const settingsDir = path.join(root, 'backend', 'config', 'settings')
  if (!existsSync(settingsDir)) return []

  let entries
  try {
    entries = readdirSync(settingsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const diagnostics: RawDiagnostic[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === 'local.py') continue

    const abs = path.join(settingsDir, entry.name)
    let content: string
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      continue
    }

    const fileRel = path.join('backend', 'config', 'settings', entry.name)
    content.split('\n').forEach((line, idx) => {
      if (line.trimStart().startsWith('#')) return
      if (SECRET_KEY_RE.test(line)) {
        diagnostics.push({
          file: fileRel,
          line: idx + 1,
          col: 1,
          severity: 'error',
          message:
            'SECRET_KEY must not be a hard-coded string literal — read it from the environment (e.g. env("DJANGO_SECRET_KEY"))',
        })
      }
      if (DEBUG_TRUE_RE.test(line)) {
        diagnostics.push({
          file: fileRel,
          line: idx + 1,
          col: 1,
          severity: 'error',
          message: 'DEBUG = True must not be hard-coded here — only local.py may enable debug mode',
        })
      }
    })
  }

  return diagnostics
}
