import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectComponentModules, uriPlaceholders } from '../../_ast.js'

/**
 * MCP010 — resource URI ↔ params consistency.
 *
 * For `@server.resource("scheme://…/{x}")`: the URI must carry a `scheme://`,
 * every `{placeholder}` must be a (non-`ctx`) parameter, and every non-`ctx`
 * parameter must be a placeholder. A no-placeholder URI (static resource) takes
 * no non-`ctx` parameters.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const mod of collectComponentModules(root)) {
    if (mod.pkg !== 'resources') continue
    for (const fn of mod.fns) {
      if (fn.kind !== 'resource') continue

      if (!fn.uri) {
        diagnostics.push(err(mod.rel, fn.line, `@server.resource for \`${fn.name}\` must declare a URI literal`))
        continue
      }
      if (!fn.uri.includes('://')) {
        diagnostics.push(err(mod.rel, fn.line, `resource URI "${fn.uri}" must include a scheme (e.g. \`scheme://…\`)`))
      }

      const placeholders = new Set(uriPlaceholders(fn.uri))
      const nonCtx = fn.params.filter((p) => p.name !== 'ctx' && p.name !== 'self').map((p) => p.name)
      const paramSet = new Set(nonCtx)

      for (const ph of placeholders) {
        if (!paramSet.has(ph)) {
          diagnostics.push(
            err(mod.rel, fn.line, `URI placeholder \`{${ph}}\` has no matching parameter on \`${fn.name}\``),
          )
        }
      }
      for (const p of nonCtx) {
        if (!placeholders.has(p)) {
          diagnostics.push(
            err(
              mod.rel,
              fn.line,
              `parameter \`${p}\` of \`${fn.name}\` is not a URI placeholder — a static resource takes no parameters`,
            ),
          )
        }
      }
    }
  }

  return diagnostics
}

function err(file: string, line: number, message: string): RawDiagnostic {
  return { file, line, col: 1, severity: 'error', message }
}
