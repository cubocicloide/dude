import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { appDir, appRel, isDir, isFile } from '../../_ast.js'

/** Files that must exist directly under `fastmcp/app/`. */
const REQUIRED_FILES = ['__main__.py', 'server.py', 'config.py']
/** Directories that must exist directly under `fastmcp/app/`. */
const REQUIRED_DIRS = ['features', 'schemas', 'utils', 'tests']
/** Sub-directories that `fastmcp/app/tests/` must contain (mirrors app/). */
const REQUIRED_TESTS_DIRS = ['features', 'utils']

/**
 * MCP001 — required project structure.
 *
 * `fastmcp/app/` must contain `__main__.py`, `server.py`, `config.py`, and the
 * `features/`, `schemas/`, `utils/`, `tests/` packages. `tests/` must mirror the
 * app (a `tests/features/` and a `tests/utils/`).
 */
export default function check(root: string): RawDiagnostic[] {
  const app = appDir(root)
  if (!isDir(app)) {
    return [
      {
        file: appRel(),
        line: 1,
        col: 1,
        severity: 'error',
        message: 'fastmcp/app/ directory is missing',
      },
    ]
  }

  const diagnostics: RawDiagnostic[] = []

  for (const file of REQUIRED_FILES) {
    if (!isFile(path.join(app, file))) {
      diagnostics.push({
        file: appRel(),
        line: 1,
        col: 1,
        severity: 'error',
        message: `fastmcp/app/${file} is missing`,
      })
    }
  }

  for (const dir of REQUIRED_DIRS) {
    if (!isDir(path.join(app, dir))) {
      diagnostics.push({
        file: appRel(),
        line: 1,
        col: 1,
        severity: 'error',
        message: `fastmcp/app/${dir}/ is missing`,
      })
    }
  }

  const testsDir = path.join(app, 'tests')
  if (isDir(testsDir)) {
    for (const dir of REQUIRED_TESTS_DIRS) {
      if (!isDir(path.join(testsDir, dir))) {
        diagnostics.push({
          file: appRel('tests'),
          line: 1,
          col: 1,
          severity: 'error',
          message: `fastmcp/app/tests/${dir}/ is missing — tests/ must mirror app/`,
        })
      }
    }
  }

  return diagnostics
}
