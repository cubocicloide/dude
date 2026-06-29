import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectComponentModules } from '../../_ast.js'

/** I/O / persistence libraries that signal logic leaking into the binding layer. */
const FORBIDDEN_IMPORTS = [
  'httpx',
  'requests',
  'aiohttp',
  'urllib',
  'socket',
  'sqlalchemy',
  'sqlmodel',
  'sqlite3',
  'psycopg2',
  'asyncpg',
  'pymongo',
  'redis',
  'boto3',
]

/** A component body longer than this (statements) is flagged as too fat. */
const MAX_BODY_STATEMENTS = 15

/**
 * MCP008 — thin binding layer.
 *
 * Component modules adapt MCP calls to the feature's `utils/` (e.g.
 * `utils/service.py`); they must not embed logic. Deterministic slice: a
 * component module must not import I/O libraries, call `open(`, or define a
 * class. Advisory: a component body over a threshold of statements is flagged.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const mod of collectComponentModules(root)) {
    const lines = mod.content.split('\n')

    lines.forEach((line, idx) => {
      const imp = /^\s*(?:import|from)\s+([A-Za-z_][\w.]*)/.exec(line)
      if (imp) {
        const topLevel = imp[1]!.split('.')[0]!
        if (FORBIDDEN_IMPORTS.includes(topLevel)) {
          diagnostics.push({
            file: mod.rel,
            line: idx + 1,
            col: 1,
            severity: 'error',
            message: `component module must not import I/O library \`${topLevel}\` — move logic into the feature's utils/service.py`,
          })
        }
      }
      if (/^\s*class\s+\w+/.test(line)) {
        diagnostics.push({
          file: mod.rel,
          line: idx + 1,
          col: 1,
          severity: 'error',
          message: `component module must not define a class — keep logic in utils/, schemas in app/schemas/`,
        })
      }
    })

    for (const fn of mod.fns) {
      if (/\bopen\s*\(/.test(fn.bodyText)) {
        diagnostics.push({
          file: mod.rel,
          line: fn.line,
          col: 1,
          severity: 'error',
          message: `component \`${fn.name}\` calls open() — file/IO belongs in the feature's utils/, not the binding layer`,
        })
      }
      if (fn.bodyStatements > MAX_BODY_STATEMENTS) {
        diagnostics.push({
          file: mod.rel,
          line: fn.line,
          col: 1,
          severity: 'warning',
          message: `component \`${fn.name}\` has ${fn.bodyStatements} statements (> ${MAX_BODY_STATEMENTS}) — consider delegating to utils/service.py`,
        })
      }
    }
  }

  return diagnostics
}
