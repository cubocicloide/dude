import { readdirSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { appDir, appRel, isDir, read, snakeToPascal } from '../../_ast.js'

/**
 * MCP011 — schema module conventions (mirrors react-fastapi BE003).
 *
 * Every class in `app/schemas/<m>.py` must (1) extend `BaseModel` (or `SQLModel`)
 * and (2) be named with the PascalCase prefix derived from the filename
 * (`calculator.py` → `Calculator…`, `note.py` → `Note…`). Pydantic models live
 * only in `schemas/`; helper enums/mixins belong in `utils/`.
 */
export default function check(root: string): RawDiagnostic[] {
  const schemasDir = path.join(appDir(root), 'schemas')
  if (!isDir(schemasDir)) return []

  const diagnostics: RawDiagnostic[] = []
  const classRe = /^class\s+(\w+)(?:\s*\(([^)]*)\))?/gm

  for (const entry of readdirSync(schemasDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
    const expectedPrefix = snakeToPascal(entry.name.replace(/\.py$/, ''))
    const rel = appRel('schemas', entry.name)
    const content = read(path.join(schemasDir, entry.name))

    for (const m of content.matchAll(classRe)) {
      const className = m[1]!
      const bases = m[2] ?? ''
      if (!/BaseModel|SQLModel/.test(bases)) {
        diagnostics.push({
          file: rel,
          line: 1,
          col: 1,
          severity: 'error',
          message: `class \`${className}\` in ${entry.name} must extend BaseModel (or SQLModel) — only schemas belong in schemas/`,
        })
      }
      if (!className.startsWith(expectedPrefix)) {
        diagnostics.push({
          file: rel,
          line: 1,
          col: 1,
          severity: 'error',
          message: `schema class \`${className}\` in ${entry.name} must start with \`${expectedPrefix}\``,
        })
      }
    }
  }

  return diagnostics
}
