import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

interface BodyLine {
  text: string
  line: number
  indent: number
}

interface PyClass {
  name: string
  bases: string
  line: number
  body: BodyLine[]
}

function indentOf(s: string): number {
  return s.length - s.trimStart().length
}

/** Parse `class X(...):` definitions with their (indented) bodies; multi-line-base aware. */
function parseClasses(lines: string[]): PyClass[] {
  const classes: PyClass[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)class\s+(\w+)\s*\(/.exec(lines[i]!)
    if (!m) continue
    const indent = m[1]!.length
    let header = ''
    let depth = 0
    let end = i
    for (let j = i; j < lines.length; j++) {
      header += (j > i ? '\n' : '') + lines[j]!
      for (const ch of lines[j]!) {
        if (ch === '(') depth++
        else if (ch === ')') depth--
      }
      end = j
      if (depth <= 0) break
    }
    const open = header.indexOf('(')
    const close = header.lastIndexOf(')')
    const bases = close > open ? header.slice(open + 1, close) : header.slice(open + 1)
    const body: BodyLine[] = []
    for (let j = end + 1; j < lines.length; j++) {
      const text = lines[j]!
      if (text.trim() === '') continue
      const ind = indentOf(text)
      if (ind <= indent) break
      body.push({ text, line: j + 1, indent: ind })
    }
    classes.push({ name: m[2]!, bases, line: i + 1, body })
  }
  return classes
}

/** The body lines of the nested `class Meta` inside `cls`, or null when absent. */
function metaBody(cls: PyClass): BodyLine[] | null {
  const metaIdx = cls.body.findIndex((b) => /^\s*class\s+Meta\b/.test(b.text))
  if (metaIdx === -1) return null
  const metaIndent = cls.body[metaIdx]!.indent
  const out: BodyLine[] = []
  for (let i = metaIdx + 1; i < cls.body.length; i++) {
    const b = cls.body[i]!
    if (b.indent <= metaIndent) break
    out.push(b)
  }
  return out
}

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

const MODEL_BASE_RE = /(models\.Model|Abstract(Base)?User)\b/

/** BE009 — models must define __str__ and Meta.ordering */
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

    for (const cls of parseClasses(content.split('\n'))) {
      if (!MODEL_BASE_RE.test(cls.bases)) continue
      const meta = metaBody(cls)
      if (meta?.some((b) => /^\s*abstract\s*=\s*True\b/.test(b.text))) continue

      if (!cls.body.some((b) => /^\s*def\s+__str__\s*\(/.test(b.text))) {
        diagnostics.push({
          file: fileRel,
          line: cls.line,
          col: 1,
          severity: 'warning',
          message: `Model \`${cls.name}\` should define __str__ for readable admin and log output`,
        })
      }

      const hasOrdering = meta !== null && meta.some((b) => /^\s*ordering\s*[:=]/.test(b.text))
      if (!hasOrdering) {
        diagnostics.push({
          file: fileRel,
          line: cls.line,
          col: 1,
          severity: 'warning',
          message: `Model \`${cls.name}\` should define Meta.ordering — unordered querysets make DRF pagination unstable`,
        })
      }
    }
  })

  return diagnostics
}
