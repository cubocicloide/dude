import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { SERVICE, appDir, read, walkPy } from '../../_ast.js'

const PRINT_RE = /\bprint\s*\(/

/**
 * MCP015 — no `print`; surface via Context or logging.
 *
 * `print(` to stdout corrupts the stdio transport, so it is banned in `app/`
 * (tests excluded). Client-visible messaging goes through `ctx`; diagnostics
 * through the stdlib logger.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  walkPy(appDir(root), (abs, rel) => {
    if (rel.split('/')[0] === 'tests') return
    read(abs)
      .split('\n')
      .forEach((line, idx) => {
        if (PRINT_RE.test(line) && !line.trimStart().startsWith('#')) {
          diagnostics.push({
            file: path.join(SERVICE, 'app', rel),
            line: idx + 1,
            col: 1,
            severity: 'error',
            message: '`print(` corrupts the stdio transport — use `ctx` for client messages or the stdlib logger for diagnostics',
          })
        }
      })
  })

  return diagnostics
}
