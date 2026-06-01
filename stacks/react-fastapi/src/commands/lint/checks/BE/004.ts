import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const ROUTER_RE = /router\s*=\s*APIRouter\s*\(/

/** BE004 — routers/foo.py must define `router = APIRouter(...)` */
export default function check(root: string): RawDiagnostic[] {
  const routersDir = path.join(root, 'backend', 'app', 'routers')
  if (!existsSync(routersDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(routersDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
    const content = readFileSync(path.join(routersDir, entry.name), 'utf8')
    if (!ROUTER_RE.test(content)) {
      diagnostics.push({
        file: path.join('backend', 'app', 'routers', entry.name),
        line: 1,
        col: 1,
        severity: 'error',
        message: `routers/${entry.name} must define \`router = APIRouter(...)\``,
      })
    }
  }
  return diagnostics
}
