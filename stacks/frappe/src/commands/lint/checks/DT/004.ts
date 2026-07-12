import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const FIELDNAME_RE = /^[a-z][a-z0-9_]*$/

/** Apps under apps/ that have a pyproject.toml (valid bench apps). */
function listApps(root: string): string[] {
  const appsDir = path.join(root, 'apps')
  try {
    return readdirSync(appsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(appsDir, e.name, 'pyproject.toml')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

interface DoctypeDir {
  app: string
  module: string
  name: string
  rel: string // repo-relative doctype directory
}

/** Every apps/<app>/<app>/<module>/doctype/<d>/ directory. */
function listDoctypeDirs(root: string): DoctypeDir[] {
  const out: DoctypeDir[] = []
  for (const app of listApps(root)) {
    const pkg = path.join(root, 'apps', app, app)
    let moduleDirs: string[] = []
    try {
      moduleDirs = readdirSync(pkg, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(path.join(pkg, e.name, 'doctype')))
        .map((e) => e.name)
    } catch {
      continue
    }
    for (const mod of moduleDirs) {
      let names: string[] = []
      try {
        names = readdirSync(path.join(pkg, mod, 'doctype'), { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      } catch {
        continue
      }
      for (const name of names) {
        out.push({ app, module: mod, name, rel: `apps/${app}/${app}/${mod}/doctype/${name}` })
      }
    }
  }
  return out
}

/** 1-based line of the first `"fieldname": "<value>"` occurrence, or 1. */
function lineOfFieldname(raw: string, fieldname: string): number {
  const lines = raw.split('\n')
  const re = new RegExp(`"fieldname"\\s*:\\s*"${fieldname}"`)
  const idx = lines.findIndex((l) => re.test(l))
  return idx === -1 ? 1 : idx + 1
}

/**
 * DT004 — Field hygiene.
 *
 * Every entry of fields[] must carry a snake_case fieldname
 * (^[a-z][a-z0-9_]*$) — layout breaks (Section/Column/Tab Break) included —
 * and fieldnames must be unique within the DocType.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const dt of listDoctypeDirs(root)) {
    const jsonRel = `${dt.rel}/${dt.name}.json`
    const jsonAbs = path.join(root, jsonRel)
    if (!existsSync(jsonAbs)) continue // DT001 reports the missing schema

    let raw: string
    let schema: Record<string, unknown>
    try {
      raw = readFileSync(jsonAbs, 'utf8')
      schema = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue // DT002 reports the unparseable schema
    }

    const fields = Array.isArray(schema['fields']) ? (schema['fields'] as unknown[]) : []
    const seen = new Map<string, number>() // fieldname → first line

    for (const entry of fields) {
      const field = (entry ?? {}) as Record<string, unknown>
      const fieldname = typeof field['fieldname'] === 'string' ? (field['fieldname'] as string) : ''
      const label = typeof field['label'] === 'string' ? (field['label'] as string) : ''

      if (!fieldname) {
        diagnostics.push({
          file: jsonRel,
          line: 1,
          col: 1,
          severity: 'error',
          message: `DocType "${dt.name}" has a field${label ? ` (label "${label}")` : ''} without a "fieldname" — every fields[] entry needs one, layout breaks included`,
        })
        continue
      }

      const line = lineOfFieldname(raw, fieldname)

      if (!FIELDNAME_RE.test(fieldname)) {
        diagnostics.push({
          file: jsonRel,
          line,
          col: 1,
          severity: 'error',
          message: `Fieldname "${fieldname}" is not snake_case — fieldnames become DB columns and API keys and must match ^[a-z][a-z0-9_]*$`,
        })
      }

      if (seen.has(fieldname)) {
        diagnostics.push({
          file: jsonRel,
          line,
          col: 1,
          severity: 'error',
          message: `Duplicate fieldname "${fieldname}" in DocType "${dt.name}" (first declared on line ${seen.get(fieldname)}) — fieldnames must be unique within a DocType`,
        })
      } else {
        seen.set(fieldname, line)
      }
    }
  }

  return diagnostics
}
