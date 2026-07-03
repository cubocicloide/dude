import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

function walkFiles(
  dir: string,
  fileName: string,
  cb: (abs: string, rel: string) => void,
  relBase = '',
): void {
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
      if (e.name !== 'migrations' && e.name !== '__pycache__') walkFiles(abs, fileName, cb, rel)
    } else if (e.isFile() && e.name === fileName) {
      cb(abs, rel)
    }
  }
}

/**
 * Collect the argument text of a call starting at lines[startLine][openCol]
 * (the `(` character), spanning lines until the parens balance.
 */
function argSpan(lines: string[], startLine: number, openCol: number): string {
  let depth = 0
  let text = ''
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]!
    for (let k = i === startLine ? openCol : 0; k < line.length; k++) {
      const ch = line[k]!
      text += ch
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) return text
      }
    }
    text += '\n'
  }
  return text
}

const FIELD_RE = /\b(CharField|TextField)\s*\(/g

/** BE010 — no null=True on CharField/TextField */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'backend', 'apps')
  if (!existsSync(appsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  walkFiles(appsDir, 'models.py', (abs, rel) => {
    let content: string
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      return
    }
    const fileRel = path.join('backend', 'apps', rel)
    const lines = content.split('\n')

    lines.forEach((line, idx) => {
      if (line.trimStart().startsWith('#')) return
      for (const m of line.matchAll(FIELD_RE)) {
        const openCol = line.indexOf('(', m.index)
        if (openCol === -1) continue
        const span = argSpan(lines, idx, openCol)
        if (/\bnull\s*=\s*True\b/.test(span)) {
          diagnostics.push({
            file: fileRel,
            line: idx + 1,
            col: m.index + 1,
            severity: 'warning',
            message: `${m[1]} with null=True creates two empty states (NULL and "") — use blank=True with default=""`,
          })
        }
      }
    })
  })

  return diagnostics
}
