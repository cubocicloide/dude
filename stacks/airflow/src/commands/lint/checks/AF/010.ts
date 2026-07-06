import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { dagFiles, readLines, stripComment, walk, PLUGINS_DIR } from '../../_py.js'

/** Compose interpolations like ${VAR} / ${VAR:-default} (skipping $$-escaped ones). */
function composeVars(content: string): Map<string, number> {
  const found = new Map<string, number>()
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const m of (lines[i] ?? '').matchAll(/(?<!\$)\$\{([A-Z][A-Z0-9_]*)(?::-[^}]*)?\}/g)) {
      const key = m[1]
      if (key && !found.has(key)) found.set(key, i + 1)
    }
  }
  return found
}

/**
 * AF010 — every environment variable is documented in .env.example.
 *
 * `.env.example` is the contract for "what this deployment needs": each
 * `${VAR}` used by docker-compose.yml (error) and every `os.getenv`/
 * `os.environ` lookup in DAGs & plugins (warning) must appear there, so a new
 * environment can be configured by copying one file.
 */
export default function check(root: string): RawDiagnostic[] {
  const out: RawDiagnostic[] = []
  const examplePath = path.join(root, '.env.example')
  const composePath = path.join(root, 'docker-compose.yml')
  if (!existsSync(examplePath) || !existsSync(composePath)) return out

  const documented = new Set(
    readFileSync(examplePath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => (l.split('=')[0] ?? '').trim()),
  )

  for (const [name, line] of composeVars(readFileSync(composePath, 'utf8'))) {
    if (!documented.has(name)) {
      out.push({
        file: 'docker-compose.yml',
        line,
        col: 1,
        severity: 'error',
        message: `\${${name}} is not documented in .env.example — add it (with a safe default or a CHANGE-ME).`,
      })
    }
  }

  const pyFiles = [
    ...dagFiles(root),
    ...walk(path.join(root, PLUGINS_DIR))
      .filter((p) => p.endsWith('.py'))
      .map((p) => path.relative(root, p)),
  ]
  for (const rel of pyFiles) {
    const lines = readLines(root, rel)
    for (let i = 0; i < lines.length; i++) {
      const line = stripComment(lines[i] ?? '')
      for (const m of line.matchAll(
        /os\.(?:getenv\(\s*|environ(?:\.get)?\(?\s*\[?\s*)["']([A-Z][A-Z0-9_]*)["']/g,
      )) {
        const name = m[1]
        // AIRFLOW__* config keys are wired by compose/IaC, not user-facing.
        if (!name || name.startsWith('AIRFLOW__') || documented.has(name)) continue
        out.push({
          file: rel,
          line: i + 1,
          col: 1,
          severity: 'warning',
          message: `os.environ lookup of "${name}" is not documented in .env.example — add it so every environment knows to provide it.`,
        })
      }
    }
  }
  return out
}
