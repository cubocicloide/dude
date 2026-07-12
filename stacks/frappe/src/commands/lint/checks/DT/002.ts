import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

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

/**
 * DT002 — Permissions declared.
 *
 * Every DocType schema must carry a non-empty `permissions` array with at
 * least one role. A DocType without permissions is invisible/unusable for
 * every user except Administrator.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const dt of listDoctypeDirs(root)) {
    const jsonRel = `${dt.rel}/${dt.name}.json`
    const jsonAbs = path.join(root, jsonRel)
    if (!existsSync(jsonAbs)) continue // DT001 reports the missing schema

    let schema: Record<string, unknown>
    try {
      schema = JSON.parse(readFileSync(jsonAbs, 'utf8')) as Record<string, unknown>
    } catch {
      diagnostics.push({
        file: jsonRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `${dt.name}.json is not valid JSON — cannot verify DocType permissions`,
      })
      continue
    }

    const permissions = schema['permissions']
    const hasRole =
      Array.isArray(permissions) &&
      permissions.some(
        (p) => p && typeof p === 'object' && typeof (p as Record<string, unknown>)['role'] === 'string' && (p as Record<string, unknown>)['role'] !== '',
      )

    if (!hasRole) {
      diagnostics.push({
        file: jsonRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `DocType "${dt.name}" declares no permissions (need a non-empty "permissions" array with at least one "role") — without them the DocType is invisible to every non-Administrator user`,
      })
    }
  }

  return diagnostics
}
