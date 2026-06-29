import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectComponentModules } from '../../_ast.js'

const RAISE_RE = /^\s*raise\s+([A-Za-z_]\w*)/
const ASSERT_RE = /^\s*assert\b/

/**
 * MCP016 — client-facing errors are `ToolError`.
 *
 * Component modules must not `raise` a bare `Exception`/built-in or use `assert`
 * for control flow. Predictable failures raise `ToolError` (after catching the
 * service's `DomainError`), whose message is the one thing surfaced to the client.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const mod of collectComponentModules(root)) {
    mod.content.split('\n').forEach((line, idx) => {
      const raised = RAISE_RE.exec(line)
      if (raised && raised[1] !== 'ToolError') {
        diagnostics.push({
          file: mod.rel,
          line: idx + 1,
          col: 1,
          severity: 'error',
          message: `raise \`${raised[1]}\` is not client-facing — catch the service's DomainError and raise \`ToolError\` instead`,
        })
      }
      if (ASSERT_RE.test(line)) {
        diagnostics.push({
          file: mod.rel,
          line: idx + 1,
          col: 1,
          severity: 'error',
          message: '`assert` must not drive control flow in a component — raise `ToolError` for predictable failures',
        })
      }
    })
  }

  return diagnostics
}
