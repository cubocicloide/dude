import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Directories under backend/apps/ that contain an apps.py (i.e. real Django apps). */
function listApps(root: string): string[] {
  const appsDir = path.join(root, 'backend', 'apps')
  try {
    return readdirSync(appsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(appsDir, e.name, 'apps.py')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

function hasTestFiles(dir: string): boolean {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return false
  }
  for (const e of entries) {
    if (e.isFile() && /^test_.*\.py$/.test(e.name)) return true
    if (e.isDirectory() && hasTestFiles(path.join(dir, e.name))) return true
  }
  return false
}

/** BE014 — every Django app must ship a tests/ package with at least one test_*.py */
export default function check(root: string): RawDiagnostic[] {
  const diagnostics: RawDiagnostic[] = []

  for (const app of listApps(root)) {
    const appRel = `backend/apps/${app}`
    const testsDir = path.join(root, 'backend', 'apps', app, 'tests')

    if (!existsSync(testsDir)) {
      diagnostics.push({
        file: `${appRel}/apps.py`,
        line: 1,
        col: 1,
        severity: 'error',
        message: `App "apps.${app}" has no tests/ package — every app ships its own tests (${appRel}/tests/)`,
      })
      continue
    }

    if (!existsSync(path.join(testsDir, '__init__.py'))) {
      diagnostics.push({
        file: `${appRel}/tests`,
        line: 1,
        col: 1,
        severity: 'error',
        message: `${appRel}/tests/ is missing __init__.py (pytest package discovery)`,
      })
    }

    if (!hasTestFiles(testsDir)) {
      diagnostics.push({
        file: `${appRel}/tests`,
        line: 1,
        col: 1,
        severity: 'error',
        message: `App "apps.${app}" has an empty tests/ package — add at least one test_*.py`,
      })
    }
  }

  return diagnostics
}
