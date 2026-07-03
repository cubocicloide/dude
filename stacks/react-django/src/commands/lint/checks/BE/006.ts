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

const MODEL_BASE_RE = /(models\.Model|Abstract(Base)?User)\b/

/** Abstract models (Meta.abstract = True) do not require migrations. */
function isAbstract(cls: PyClass): boolean {
  return cls.body.some((b) => /^\s*abstract\s*=\s*True\b/.test(b.text))
}

/** BE006 — any app defining concrete models must have at least one migration */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'backend', 'apps')
  if (!existsSync(appsDir)) return []

  let entries
  try {
    entries = readdirSync(appsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const diagnostics: RawDiagnostic[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const app = entry.name
    const modelsPath = path.join(appsDir, app, 'models.py')
    if (!existsSync(modelsPath)) continue

    let content: string
    try {
      content = readFileSync(modelsPath, 'utf8')
    } catch {
      continue
    }

    const modelClass = parseClasses(content.split('\n')).find(
      (cls) => MODEL_BASE_RE.test(cls.bases) && !isAbstract(cls),
    )
    if (!modelClass) continue

    const migrationsDir = path.join(appsDir, app, 'migrations')
    let hasMigration = false
    if (existsSync(migrationsDir)) {
      try {
        hasMigration = readdirSync(migrationsDir).some(
          (f) => f.startsWith('0') && f.endsWith('.py'),
        )
      } catch {
        hasMigration = false
      }
    }

    if (!hasMigration) {
      diagnostics.push({
        file: path.join('backend', 'apps', app, 'models.py'),
        line: modelClass.line,
        col: 1,
        severity: 'error',
        message: `App "${app}" defines model \`${modelClass.name}\` but has no migrations — run \`python manage.py makemigrations ${app}\``,
      })
    }
  }

  return diagnostics
}
