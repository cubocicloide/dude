import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const SKIP_DIRS = new Set(['migrations', '__pycache__', 'tests'])

const PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\.raw\(/, label: '.raw(' },
  { re: /\bcursor\.execute\(/, label: 'cursor.execute(' },
  { re: /\bRawSQL\(/, label: 'RawSQL(' },
  { re: /\bconnection\.cursor\(/, label: 'connection.cursor(' },
]

function isTestFile(name: string): boolean {
  return name.startsWith('test_') || name === 'tests.py' || name === 'conftest.py'
}

function walkPy(dir: string, cb: (abs: string, rel: string) => void, relBase = ''): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    const rel = relBase ? `${relBase}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walkPy(abs, cb, rel)
    } else if (e.isFile() && e.name.endsWith('.py') && !isTestFile(e.name)) {
      cb(abs, rel)
    }
  }
}

/** BE004 — no raw SQL anywhere in backend app code (apps/ + config/) */
export default function check(root: string): RawDiagnostic[] {
  const backendDir = path.join(root, 'backend')
  if (!existsSync(backendDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const sub of ['apps', 'config']) {
    const dir = path.join(backendDir, sub)
    if (!existsSync(dir)) continue
    walkPy(dir, (abs, rel) => {
      let content: string
      try {
        content = readFileSync(abs, 'utf8')
      } catch {
        return
      }
      const fileRel = path.join('backend', sub, rel)
      content.split('\n').forEach((line, idx) => {
        if (line.trimStart().startsWith('#')) return
        for (const { re, label } of PATTERNS) {
          const m = re.exec(line)
          if (m) {
            diagnostics.push({
              file: fileRel,
              line: idx + 1,
              col: m.index + 1,
              severity: 'error',
              message: `Raw SQL is forbidden — use the Django ORM instead of \`${label})\``,
            })
          }
        }
      })
    })
  }

  return diagnostics
}
