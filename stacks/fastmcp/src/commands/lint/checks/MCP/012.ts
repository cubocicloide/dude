import { readdirSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { SERVICE, SNAKE_RE, appDir, collectComponentModules, isDir } from '../../_ast.js'

/**
 * MCP012 — naming conventions.
 *
 * Component function names and all module/folder names under `app/` are
 * `snake_case`.
 */
export default function check(root: string): RawDiagnostic[] {
  const app = appDir(root)
  if (!isDir(app)) return []

  const diagnostics: RawDiagnostic[] = []

  // ── Folder + module names under app/ ──────────────────────────────────────────
  walkNames(app, 'app', (name, isDirectory, rel) => {
    const label = isDirectory ? 'folder' : 'module'
    if (!SNAKE_RE.test(name)) {
      diagnostics.push({
        file: path.join(SERVICE, rel),
        line: 1,
        col: 1,
        severity: 'error',
        message: `${label} name \`${name}\` must be snake_case`,
      })
    }
  })

  // ── Component function names ──────────────────────────────────────────────────
  for (const mod of collectComponentModules(root)) {
    for (const fn of mod.fns) {
      if (!SNAKE_RE.test(fn.name)) {
        diagnostics.push({
          file: mod.rel,
          line: fn.line,
          col: 1,
          severity: 'error',
          message: `component name \`${fn.name}\` must be snake_case`,
        })
      }
    }
  }

  return diagnostics
}

/** Visit every directory name and `.py` module stem under `dir` (skipping caches/tests cruft). */
function walkNames(
  dir: string,
  relBase: string,
  cb: (name: string, isDir: boolean, rel: string) => void,
): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__pycache__' || e.name.startsWith('.')) continue
    const rel = `${relBase}/${e.name}`
    if (e.isDirectory()) {
      cb(e.name, true, rel)
      walkNames(path.join(dir, e.name), rel, cb)
    } else if (e.isFile() && e.name.endsWith('.py')) {
      cb(e.name.slice(0, -3), false, rel)
    }
  }
}
