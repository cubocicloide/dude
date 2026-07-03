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
  indent: number
  body: BodyLine[]
}

function indentOf(s: string): number {
  return s.length - s.trimStart().length
}

/** Parse top-level and nested `class X(...):` definitions with their (indented) bodies. */
function parseClasses(lines: string[]): PyClass[] {
  const classes: PyClass[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)class\s+(\w+)\s*\(/.exec(lines[i]!)
    if (!m) continue
    const indent = m[1]!.length
    // Join header lines until the base-list parens balance (multi-line bases).
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
    classes.push({ name: m[2]!, bases, line: i + 1, indent, body })
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

const ALL_RE = /^\s*fields\s*=\s*["']__all__["']/
const EXCLUDE_RE = /^\s*exclude\s*=/
const FIELDS_RE = /^\s*fields\s*[:=]/

/** BE002 — serializers must declare explicit fields (no __all__, no exclude) */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'backend', 'apps')
  if (!existsSync(appsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  walkFiles(appsDir, 'serializers.py', (abs, rel) => {
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
      if (ALL_RE.test(line)) {
        diagnostics.push({
          file: fileRel,
          line: idx + 1,
          col: indentOf(line) + 1,
          severity: 'error',
          message:
            'fields = "__all__" is forbidden — declare an explicit fields list in the serializer Meta',
        })
      } else if (EXCLUDE_RE.test(line)) {
        diagnostics.push({
          file: fileRel,
          line: idx + 1,
          col: indentOf(line) + 1,
          severity: 'error',
          message:
            'exclude = ... is forbidden in serializer Meta — declare an explicit fields list instead',
        })
      }
    })

    for (const cls of parseClasses(lines)) {
      if (!/ModelSerializer\b/.test(cls.bases)) continue
      const meta = metaBody(cls)
      if (meta === null) {
        diagnostics.push({
          file: fileRel,
          line: cls.line,
          col: 1,
          severity: 'error',
          message: `ModelSerializer \`${cls.name}\` must define a Meta class with an explicit fields list`,
        })
        continue
      }
      const hasFields = meta.some((b) => FIELDS_RE.test(b.text))
      const hasExclude = meta.some((b) => EXCLUDE_RE.test(b.text))
      if (!hasFields && !hasExclude) {
        diagnostics.push({
          file: fileRel,
          line: cls.line,
          col: 1,
          severity: 'error',
          message: `ModelSerializer \`${cls.name}\` Meta must declare an explicit fields list/tuple`,
        })
      }
    }
  })

  return diagnostics
}
