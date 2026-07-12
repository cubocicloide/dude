import { existsSync, readdirSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/** Files every Frappe app python package must ship. */
const REQUIRED_FILES = ['hooks.py', 'modules.txt', 'patches.txt', '__init__.py']

/** Does this directory (recursively) contain any .py file? */
function containsPython(dir: string): boolean {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return false
  }
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.py')) return true
    if (e.isDirectory() && !e.name.startsWith('.') && containsPython(path.join(dir, e.name))) {
      return true
    }
  }
  return false
}

/**
 * APP001 — App layout integrity.
 *
 * Every apps/<app>/ with a pyproject.toml must contain the python package
 * apps/<app>/<app>/ with hooks.py, modules.txt, patches.txt and __init__.py.
 * Directories under apps/ that are not valid apps but contain python files
 * get a warning: bench provisioning will ignore them.
 */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'apps')
  let entries
  try {
    entries = readdirSync(appsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const diagnostics: RawDiagnostic[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue // README.md etc. at apps/ root
    const app = entry.name
    const appDir = path.join(appsDir, app)

    if (!existsSync(path.join(appDir, 'pyproject.toml'))) {
      if (containsPython(appDir)) {
        diagnostics.push({
          file: `apps/${app}`,
          line: 1,
          col: 1,
          severity: 'warning',
          message: `apps/${app}/ contains Python files but no pyproject.toml — it is not a valid Frappe app and will be ignored by the bench provisioning`,
        })
      }
      continue
    }

    const pkgDir = path.join(appDir, app)
    if (!existsSync(pkgDir)) {
      diagnostics.push({
        file: `apps/${app}/pyproject.toml`,
        line: 1,
        col: 1,
        severity: 'error',
        message: `Python package apps/${app}/${app}/ is missing — a Frappe app needs a package named after the app (bench cannot install it otherwise)`,
      })
      continue
    }

    for (const required of REQUIRED_FILES) {
      if (!existsSync(path.join(pkgDir, required))) {
        diagnostics.push({
          file: `apps/${app}/${app}/${required}`,
          line: 1,
          col: 1,
          severity: 'error',
          message: `apps/${app}/${app}/${required} is missing — required by the Frappe app contract (bench install/migrate reads it)`,
        })
      }
    }
  }

  return diagnostics
}
