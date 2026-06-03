import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const REQUIRED_DIRS = [
  'core',
  'fixtures',
  'management',
  'models',
  'queries',
  'routers',
  'schemas',
  'tasks',
  'tests',
  'utils',
]
const REQUIRED_FILES = ['main.py', '__init__.py']

/** Required layout inside tests/: subdirs and files that must exist. */
const REQUIRED_TESTS_DIRS = ['models', 'queries', 'routers', 'tasks', 'utils']
const REQUIRED_TESTS_FILES = ['__init__.py', 'conftest.py']

/** BE001 — backend/app/ must contain the required directories, files, and tests/ sub-structure */
export default function check(root: string): RawDiagnostic[] {
  const appDir = path.join(root, 'backend', 'app')
  const appRel = path.join('backend', 'app')

  if (!existsSync(appDir)) {
    return [
      {
        file: appRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: 'backend/app/ directory is missing',
      },
    ]
  }

  const diagnostics: RawDiagnostic[] = []

  for (const dir of REQUIRED_DIRS) {
    if (!existsSync(path.join(appDir, dir))) {
      diagnostics.push({
        file: appRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `backend/app/${dir}/ is missing`,
      })
    }
  }

  for (const file of REQUIRED_FILES) {
    if (!existsSync(path.join(appDir, file))) {
      diagnostics.push({
        file: appRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `backend/app/${file} is missing`,
      })
    }
  }

  // tests/ internal structure
  const testsDir = path.join(appDir, 'tests')
  if (existsSync(testsDir)) {
    const testsRel = path.join('backend', 'app', 'tests')
    for (const dir of REQUIRED_TESTS_DIRS) {
      if (!existsSync(path.join(testsDir, dir))) {
        diagnostics.push({
          file: testsRel,
          line: 1,
          col: 1,
          severity: 'error',
          message: `backend/app/tests/${dir}/ is missing`,
        })
      } else if (!existsSync(path.join(testsDir, dir, '__init__.py'))) {
        diagnostics.push({
          file: path.join(testsRel, dir),
          line: 1,
          col: 1,
          severity: 'error',
          message: `backend/app/tests/${dir}/__init__.py is missing`,
        })
      }
    }
    for (const file of REQUIRED_TESTS_FILES) {
      if (!existsSync(path.join(testsDir, file))) {
        diagnostics.push({
          file: testsRel,
          line: 1,
          col: 1,
          severity: 'error',
          message: `backend/app/tests/${file} is missing`,
        })
      }
    }
  }

  return diagnostics
}
