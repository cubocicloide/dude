import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const SKIP_DIRS = new Set(['migrations', '__pycache__', 'tests'])

/** print( not preceded by a dot or word char (so `self.stdout.print(`-style methods pass). */
const PRINT_RE = /(?<![.\w])print\(/

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

/** BE012 — no print() in app/config code; use the logging module */
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
        const m = PRINT_RE.exec(line)
        if (m) {
          diagnostics.push({
            file: fileRel,
            line: idx + 1,
            col: m.index + 1,
            severity: 'warning',
            message: 'print() found — use the logging module (logging.getLogger(__name__)) instead',
          })
        }
      })
    })
  }

  return diagnostics
}
