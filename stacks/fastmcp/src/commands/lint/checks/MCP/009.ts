import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectComponentModules } from '../../_ast.js'

/**
 * MCP009 — Context convention.
 *
 * A Context parameter must be named `ctx` and annotated `Context`. Any component
 * that takes `ctx` (or references `ctx.` in its body) must be `async def` — the
 * Context API is awaited.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const mod of collectComponentModules(root)) {
    for (const fn of mod.fns) {
      const sig = fn.signature
      const ctxParam = fn.params.find((p) => p.name === 'ctx')

      // A param annotated `Context` that is not named `ctx`.
      const misnamed = /\b(\w+)\s*:\s*Context\b/.exec(sig)
      if (misnamed && misnamed[1] !== 'ctx') {
        diagnostics.push(
          err(mod.rel, fn.line, `Context parameter \`${misnamed[1]}\` must be named \`ctx\``),
        )
      }

      // A param named `ctx` must be annotated Context.
      if (ctxParam && !/\bctx\s*:\s*Context\b/.test(sig)) {
        diagnostics.push(
          err(mod.rel, fn.line, `parameter \`ctx\` of \`${fn.name}\` must be annotated \`Context\``),
        )
      }

      // Uses Context → must be async.
      const usesCtx = fn.hasCtxParam || /\bctx\./.test(fn.bodyText)
      if (usesCtx && !fn.isAsync) {
        diagnostics.push(
          err(mod.rel, fn.line, `\`${fn.name}\` uses Context (\`ctx\`) and must be \`async def\``),
        )
      }
    }
  }

  return diagnostics
}

function err(file: string, line: number, message: string): RawDiagnostic {
  return { file, line, col: 1, severity: 'error', message }
}
