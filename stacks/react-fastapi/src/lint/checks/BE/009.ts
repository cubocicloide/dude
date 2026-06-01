import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Matches any direct env-var access that should only live in core/config.py */
const OS_ENV_RE = /\bos\.(getenv|environ)\b/

/**
 * Extract field names from the first `class … (BaseSettings)` block.
 * Only captures simple `FIELD_NAME: …` or `FIELD_NAME = …` lines at one
 * level of indentation (body of the class, not nested).
 */
function extractSettingsFields(content: string): string[] {
  const lines = content.split('\n')
  let inClass = false
  let classIndent = 0
  const fields: string[] = []

  for (const raw of lines) {
    if (!inClass) {
      if (/^class\s+\w+\s*\(.*BaseSettings.*\)\s*:/.test(raw)) {
        inClass = true
        classIndent = 0
      }
      continue
    }
    // End of class body: non-indented non-blank line
    if (raw.length > 0 && !/^\s/.test(raw)) break
    const stripped = raw.trimStart()
    const indent = raw.length - stripped.length
    // Stop descending into nested classes (e.g. class Config:)
    if (/^class\s+/.test(stripped)) { classIndent = indent; continue }
    // Skip lines that belong to a nested class body
    if (classIndent > 0 && indent > classIndent) continue
    classIndent = 0
    // Field: `    FIELD_NAME: Type` or `    FIELD_NAME = …`
    const m = /^([A-Za-z_]\w*)\s*[:=]/.exec(stripped)
    if (m?.[1] && !m[1].startsWith('__') && m[1] !== 'class') {
      fields.push(m[1])
    }
  }
  return fields
}

function walkPyFiles(
  dir: string,
  skipDir: (name: string) => boolean,
  callback: (filePath: string, relPath: string) => void,
  relBase = '',
): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    const rel = relBase ? `${relBase}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (!skipDir(e.name)) walkPyFiles(abs, skipDir, callback, rel)
    } else if (e.isFile() && e.name.endsWith('.py')) {
      callback(abs, rel)
    }
  }
}

/**
 * BE009 — environment variables must be centralised in core/config.py.
 *
 * Warning: core/config.py is missing.
 * Error:   os.getenv / os.environ used outside backend/app/core/.
 * Warning: Settings fields in core/config.py are not in alphabetical order.
 */
export default function check(root: string): RawDiagnostic[] {
  const appDir = path.join(root, 'backend', 'app')
  if (!existsSync(appDir)) return []

  const configPath = path.join(appDir, 'core', 'config.py')
  const appRel = path.join('backend', 'app')
  const diagnostics: RawDiagnostic[] = []

  // 1. Warning if core/config.py is missing
  if (!existsSync(configPath)) {
    diagnostics.push({
      file: path.join(appRel, 'core'),
      line: 1, col: 1, severity: 'warning',
      message:
        'backend/app/core/config.py is missing — create a Pydantic BaseSettings class to centralise env vars',
    })
  }

  // 2. Error: os.getenv / os.environ used outside core/
  const coreDir = path.join(appDir, 'core')
  walkPyFiles(
    appDir,
    // Skip the core/ subtree entirely — that's the allowed place
    (name) => name === 'core' || name === '__pycache__',
    (absPath, relPath) => {
      const content = readFileSync(absPath, 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        if (OS_ENV_RE.test(line) && !line.trimStart().startsWith('#')) {
          diagnostics.push({
            file: path.join(appRel, relPath),
            line: idx + 1, col: 1, severity: 'error',
            message: `\`os.environ\`/\`os.getenv\` must not be used here — read env vars from \`app.core.config\``,
          })
        }
      })
    },
  )

  // 3. Warning: Settings fields not in alphabetical order
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8')
    const fields = extractSettingsFields(content)
    const sorted = [...fields].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    const firstMismatch = fields.findIndex((f, i) => f.toLowerCase() !== sorted[i]?.toLowerCase())
    if (firstMismatch !== -1) {
      const actual = fields[firstMismatch]!
      const expected = sorted[firstMismatch]!
      const hint =
        firstMismatch === 0
          ? `first field \`${actual}\` should be \`${expected}\``
          : `\`${actual}\` should come after \`${fields[firstMismatch - 1]}\``
      diagnostics.push({
        file: path.join(appRel, 'core', 'config.py'),
        line: 1, col: 1, severity: 'warning',
        message: `Settings fields are not in alphabetical order — ${hint}`,
      })
    }
  }

  return diagnostics
}
