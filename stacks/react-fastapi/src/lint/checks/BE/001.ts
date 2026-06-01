import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const REQUIRED_DIRS = ['models', 'routers', 'schemas']
const REQUIRED_FILES = ['main.py', '__init__.py']

/** BE001 — backend/app/ must contain models/, routers/, schemas/, main.py, __init__.py */
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
  return diagnostics
}
