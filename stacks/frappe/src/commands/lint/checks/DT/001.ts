import { existsSync, readdirSync } from 'node:fs'
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
  module: string // module directory name, e.g. "ticketing"
  name: string // doctype directory name, e.g. "ticket_escalation_rule"
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
 * DT001 — DocType bundle completeness.
 *
 * Every doctype directory must contain the schema (<d>.json), the controller
 * (<d>.py) and __init__.py. The .js form script is optional.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const dt of listDoctypeDirs(root)) {
    const required = [`${dt.name}.json`, `${dt.name}.py`, '__init__.py']
    for (const file of required) {
      if (!existsSync(path.join(root, dt.rel, file))) {
        diagnostics.push({
          file: `${dt.rel}/${file}`,
          line: 1,
          col: 1,
          severity: 'error',
          message: `DocType bundle "${dt.name}" is missing ${file} — Frappe expects schema JSON, controller and __init__.py side by side in the doctype directory`,
        })
      }
    }
  }

  return diagnostics
}
