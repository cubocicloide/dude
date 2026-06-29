import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { SERVICE, appDir, appRel, isFile, read, walkPy } from '../../_ast.js'

const OS_ENV_RE = /\bos\.(getenv|environ)\b/

/**
 * MCP014 — centralised configuration (mirrors react-fastapi BE009).
 *
 * Environment variables are read only in `config.py` via a `BaseSettings`
 * subclass. `os.getenv` / `os.environ` anywhere else under `app/` is an error.
 */
export default function check(root: string): RawDiagnostic[] {
  const app = appDir(root)
  const diagnostics: RawDiagnostic[] = []

  if (!isFile(path.join(app, 'config.py'))) {
    diagnostics.push({
      file: appRel(),
      line: 1,
      col: 1,
      severity: 'warning',
      message: 'fastmcp/app/config.py is missing — centralise env vars in a Pydantic BaseSettings class',
    })
  }

  walkPy(app, (abs, rel) => {
    if (rel === 'config.py') return // the one allowed place
    const lines = read(abs).split('\n')
    lines.forEach((line, idx) => {
      if (OS_ENV_RE.test(line) && !line.trimStart().startsWith('#')) {
        diagnostics.push({
          file: path.join(SERVICE, 'app', rel),
          line: idx + 1,
          col: 1,
          severity: 'error',
          message: '`os.environ`/`os.getenv` must not be used here — read settings from `app.config`',
        })
      }
    })
  })

  return diagnostics
}
