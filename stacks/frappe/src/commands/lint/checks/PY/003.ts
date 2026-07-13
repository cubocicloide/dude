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
          .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== '__pycache__')
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
 * PY003 — DocType tests exist (warning).
 *
 * Every doctype directory should ship a test_<d>.py next to the controller —
 * `bench run-tests` discovers it automatically.
 */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const dt of listDoctypeDirs(root)) {
    const testFile = `test_${dt.name}.py`
    if (existsSync(path.join(root, dt.rel, testFile))) continue

    const controllerRel = `${dt.rel}/${dt.name}.py`
    const reportRel = existsSync(path.join(root, controllerRel)) ? controllerRel : dt.rel

    diagnostics.push({
      file: reportRel,
      line: 1,
      col: 1,
      severity: 'warning',
      message: `DocType "${dt.name}" has no ${testFile} — add one next to the controller so \`bench run-tests\` (and \`dude test\`) exercises it`,
    })
  }

  return diagnostics
}
