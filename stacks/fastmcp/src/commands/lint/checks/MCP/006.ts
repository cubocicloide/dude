import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectComponentModules } from '../../_ast.js'

/**
 * MCP006 — docstring required.
 *
 * Every decorated tool/resource/prompt function must have a non-empty docstring
 * — it becomes the description the model sees when choosing the component.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []
  for (const mod of collectComponentModules(root)) {
    for (const fn of mod.fns) {
      if (!fn.hasDocstring) {
        diagnostics.push({
          file: mod.rel,
          line: fn.line,
          col: 1,
          severity: 'error',
          message: `component \`${fn.name}\` is missing a docstring — it becomes the description the model sees`,
        })
      }
    }
  }
  return diagnostics
}
