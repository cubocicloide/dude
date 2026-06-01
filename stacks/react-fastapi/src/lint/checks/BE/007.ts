import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const DECORATOR_RE = /^@router\.(get|post|put|patch|delete)\s*\(/
const DEF_RE = /^(?:async\s+)?def\s+(\w+)/

interface RouteHandler {
  method: string
  fnName: string
  line: number
}

/**
 * Scan a router file for `@router.METHOD` + `def FUNCNAME` pairs.
 * Handles multi-line decorator arguments and stacked decorators.
 */
function parseRouteHandlers(content: string): RouteHandler[] {
  const lines = content.split('\n')
  const handlers: RouteHandler[] = []
  let pendingMethod: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()

    const decMatch = DECORATOR_RE.exec(line)
    if (decMatch?.[1]) {
      pendingMethod = decMatch[1]
      continue
    }

    if (pendingMethod !== null) {
      const defMatch = DEF_RE.exec(line)
      if (defMatch?.[1]) {
        handlers.push({ method: pendingMethod, fnName: defMatch[1], line: i + 1 })
        pendingMethod = null
      }
      // else: continuation line of a multi-line decorator, or another stacked decorator —
      // keep pendingMethod and keep scanning
    }
  }
  return handlers
}

/**
 * Compute the allowed function names for every HTTP method on a given router stem.
 * Convention: `{method}_{stem}` — e.g. stem=todos__id → get_todos__id, patch_todos__id, …
 */
export function allowedHandlerName(method: string, stem: string): string {
  return `${method}_${stem}`
}

/** BE007 — route handler functions must be named `{method}_{stem}` (e.g. get_health in health.py) */
export default function check(root: string): RawDiagnostic[] {
  const routersDir = path.join(root, 'backend', 'app', 'routers')
  if (!existsSync(routersDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(routersDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue

    const stem = entry.name.slice(0, -3)
    const relPath = path.join('backend', 'app', 'routers', entry.name)
    const content = readFileSync(path.join(routersDir, entry.name), 'utf8')

    for (const { method, fnName, line } of parseRouteHandlers(content)) {
      const expected = allowedHandlerName(method, stem)
      if (fnName !== expected) {
        diagnostics.push({
          file: relPath,
          line,
          col: 1,
          severity: 'error',
          message: `route handler \`${fnName}\` should be named \`${expected}\``,
        })
      }
    }
  }
  return diagnostics
}
