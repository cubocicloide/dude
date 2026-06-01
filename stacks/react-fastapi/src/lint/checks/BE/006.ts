import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/**
 * Valid router stem: one or more lowercase-alphanumeric segments separated by
 * `_` (sub-resource, e.g. users_me) or `__` (path param, e.g. todos__id).
 * Examples: health, todos, todos__id, users_me, keycloak_token_refresh
 */
const STEM_RE = /^[a-z][a-z0-9]*(_[a-z][a-z0-9]*|__[a-z][a-z0-9]*)*$/

/** BE006 — router filenames must follow {resource}[_sub|__param].py convention */
export default function check(root: string): RawDiagnostic[] {
  const routersDir = path.join(root, 'backend', 'app', 'routers')
  if (!existsSync(routersDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(routersDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
    const stem = entry.name.slice(0, -3)
    if (!STEM_RE.test(stem)) {
      diagnostics.push({
        file: path.join('backend', 'app', 'routers', entry.name),
        line: 1,
        col: 1,
        severity: 'error',
        message: `routers/${entry.name}: stem \`${stem}\` must be lowercase segments separated by _ (sub-resource) or __ (path param)`,
      })
    }
  }
  return diagnostics
}
