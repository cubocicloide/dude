import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { SERVICE, appDir, read, walkPy } from '../../_ast.js'

type Kind = 'tool' | 'resource' | 'prompt'
const PKG_FOR: Record<string, Kind> = { tools: 'tool', resources: 'resource', prompts: 'prompt' }

/**
 * MCP004 — component placement & purity.
 *
 * `@server.tool` may appear only under a feature's `tools/`, `@server.resource`
 * only under `resources/`, `@server.prompt` only under `prompts/`. `server.py`,
 * `config.py`, `schemas/`, `utils/` (global & per-feature) and `core/` must
 * contain no component decorators.
 */
export default function check(root: string): RawDiagnostic[] {
  const app = appDir(root)
  const diagnostics: RawDiagnostic[] = []

  walkPy(app, (abs, rel) => {
    const parts = rel.split('/')
    if (parts[0] === 'tests') return

    const lines = read(abs).split('\n')
    const decorators: { kind: Kind; line: number }[] = []
    lines.forEach((line, idx) => {
      const m = /@server\.(tool|resource|prompt)\b/.exec(line)
      if (m) decorators.push({ kind: m[1] as Kind, line: idx + 1 })
    })
    if (decorators.length === 0) return

    const parent = parts.length >= 2 ? parts[parts.length - 2]! : ''
    const underFeature = parts[0] === 'features'
    const allowed: Kind | null = underFeature && parent in PKG_FOR ? PKG_FOR[parent]! : null
    const fileRel = path.join(SERVICE, 'app', rel)

    for (const d of decorators) {
      if (allowed === null) {
        diagnostics.push({
          file: fileRel,
          line: d.line,
          col: 1,
          severity: 'error',
          message: `@server.${d.kind} must live in a feature's ${plural(d.kind)}/ package, not here`,
        })
      } else if (d.kind !== allowed) {
        diagnostics.push({
          file: fileRel,
          line: d.line,
          col: 1,
          severity: 'error',
          message: `@server.${d.kind} cannot live in ${parent}/ — only @server.${allowed} belongs here`,
        })
      }
    }
  })

  return diagnostics
}

function plural(kind: Kind): string {
  return kind === 'tool' ? 'tools' : kind === 'resource' ? 'resources' : 'prompts'
}
