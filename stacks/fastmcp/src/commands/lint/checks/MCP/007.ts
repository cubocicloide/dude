import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectComponentModules } from '../../_ast.js'

/**
 * MCP007 — full type annotations.
 *
 * Every parameter (except the injected `ctx`) and the return type of a decorated
 * component must be annotated — FastMCP derives the JSON schema from the hints.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const mod of collectComponentModules(root)) {
    for (const fn of mod.fns) {
      for (const p of fn.params) {
        if (p.name === 'ctx' || p.name === 'self') continue
        if (!p.annotated) {
          diagnostics.push({
            file: mod.rel,
            line: fn.line,
            col: 1,
            severity: 'error',
            message: `parameter \`${p.name}\` of \`${fn.name}\` must be type-annotated`,
          })
        }
      }
      if (!fn.hasReturnAnnotation) {
        diagnostics.push({
          file: mod.rel,
          line: fn.line,
          col: 1,
          severity: 'error',
          message: `\`${fn.name}\` must declare a return type annotation (\`-> …\`)`,
        })
      }
    }
  }
  return diagnostics
}
