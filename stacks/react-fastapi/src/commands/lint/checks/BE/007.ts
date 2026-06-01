import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const ROUTER_DECORATOR_RE = /^@router\.(get|post|put|patch|delete)\s*\(/
const STRING_LITERAL_RE = /["']([^"']+)["']/
const DEF_RE = /^(?:async\s+)?def\s+(\w+)/

interface RouteInfo {
  /** null = undecorated function (not a route handler) */
  method: string | null
  fnName: string
  /** null if method is null or path could not be extracted */
  declaredPath: string | null
  line: number
}

/**
 * Derive the expected URL path from a router filename stem.
 *
 * Rules:
 *  - `__param`  (double underscore) → `/{param}` (path parameter)
 *  - `_segment` (single underscore) → `/segment` (literal path segment)
 *
 * Examples:
 *  health            → /health
 *  todos             → /todos
 *  todos__id         → /todos/{id}
 *  users_me          → /users/me
 *  keycloak_token    → /keycloak/token
 */
export function stemToExpectedPath(stem: string): string {
  const parts = stem.split('__')
  const base = '/' + (parts[0] ?? '').replace(/_/g, '/')
  const params = parts.slice(1).map((p) => `/{${p}}`)
  return base + params.join('')
}

/**
 * Try to find the first string literal (= the path argument) in the decorator
 * call starting at `lineIdx`, scanning forward across multi-line decorators.
 */
function extractDecoratorPath(lines: string[], lineIdx: number): string | null {
  for (let i = lineIdx; i < Math.min(lineIdx + 8, lines.length); i++) {
    const line = lines[i] ?? ''
    const m = STRING_LITERAL_RE.exec(line)
    if (m?.[1]) return m[1]
    // Stop at closing paren of the decorator if no string found yet
    if (i > lineIdx && /^\)/.test(line.trim())) break
  }
  return null
}

/**
 * Scan a router file line-by-line (module-level lines only).
 * Returns one RouteInfo per top-level function definition.
 */
function parseRoutes(content: string): RouteInfo[] {
  const lines = content.split('\n')
  const results: RouteInfo[] = []
  let pendingMethod: string | null = null
  let pendingPath: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ''

    // Only analyse module-level lines (no leading whitespace)
    if (raw.length > 0 && /^\s/.test(raw)) continue

    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    // @router.METHOD decorator
    const decMatch = ROUTER_DECORATOR_RE.exec(line)
    if (decMatch?.[1]) {
      pendingMethod = decMatch[1]
      pendingPath = extractDecoratorPath(lines, i)
      continue
    }

    // def / async def
    const defMatch = DEF_RE.exec(line)
    if (defMatch?.[1]) {
      results.push({
        method: pendingMethod,
        fnName: defMatch[1],
        declaredPath: pendingPath,
        line: i + 1,
      })
      pendingMethod = null
      pendingPath = null
      continue
    }

    // Any other module-level statement (import, class, assignment, closing paren
    // of multi-line decorator) — only reset if it's clearly not part of a decorator
    if (!line.startsWith('@') && !line.startsWith(')')) {
      pendingMethod = null
      pendingPath = null
    }
  }
  return results
}

export function allowedHandlerName(method: string, stem: string): string {
  return `${method}_${stem}`
}

/**
 * BE007 — router files may only contain @router.METHOD-decorated functions,
 * each named `{method}_{stem}` and mapped to the path derived from the filename.
 *
 * Examples for `todos__id.py` (stem=todos__id, expectedPath=/todos/{id}):
 *   ✓  @router.get("/todos/{id}")  async def get_todos__id(...)
 *   ✗  def ciao()  — not a route handler
 *   ✗  @router.get("/wrong")  async def get_todos__id(...)  — wrong path
 *   ✗  @router.get("/todos/{id}")  async def fetch_item(...)  — wrong name
 */
export default function check(root: string): RawDiagnostic[] {
  const routersDir = path.join(root, 'backend', 'app', 'routers')
  if (!existsSync(routersDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const entry of readdirSync(routersDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue

    const stem = entry.name.slice(0, -3)
    const relPath = path.join('backend', 'app', 'routers', entry.name)
    const content = readFileSync(path.join(routersDir, entry.name), 'utf8')
    const expectedPath = stemToExpectedPath(stem)

    for (const route of parseRoutes(content)) {
      // Non-route function
      if (route.method === null) {
        diagnostics.push({
          file: relPath,
          line: route.line,
          col: 1,
          severity: 'error',
          message: `\`${route.fnName}\` is not a route handler — only @router.METHOD-decorated functions are allowed in router files`,
        })
        continue
      }

      // Wrong function name
      const expected = allowedHandlerName(route.method, stem)
      if (route.fnName !== expected) {
        diagnostics.push({
          file: relPath,
          line: route.line,
          col: 1,
          severity: 'error',
          message: `route handler \`${route.fnName}\` should be named \`${expected}\``,
        })
      }

      // Wrong path
      if (route.declaredPath !== null && route.declaredPath !== expectedPath) {
        diagnostics.push({
          file: relPath,
          line: route.line,
          col: 1,
          severity: 'error',
          message: `route path \`${route.declaredPath}\` does not match expected \`${expectedPath}\` (derived from \`${entry.name}\`)`,
        })
      }
    }
  }

  return diagnostics
}
