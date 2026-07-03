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

/** Matches DRF view bases: APIView, GenericAPIView, ListAPIView…, *ViewSet, generics.* */
const VIEW_BASE_RE = /(APIView|ViewSet)\b|\bgenerics\./

/** BE003 — every DRF view class must declare permission_classes explicitly */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'backend', 'apps')
  if (!existsSync(appsDir)) return []

  const diagnostics: RawDiagnostic[] = []

  walkFiles(appsDir, 'views.py', (abs, rel) => {
    let content: string
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      return
    }
    const fileRel = path.join('backend', 'apps', rel)
    for (const cls of parseClasses(content.split('\n'))) {
      if (!VIEW_BASE_RE.test(cls.bases)) continue
      const hasPermissions = cls.body.some((b) => /^\s*permission_classes\s*[:=]/.test(b.text))
      if (!hasPermissions) {
        diagnostics.push({
          file: fileRel,
          line: cls.line,
          col: 1,
          severity: 'error',
          message: `View class \`${cls.name}\` must declare permission_classes explicitly — never rely on the implicit default`,
        })
      }
    }
  })

  return diagnostics
}
