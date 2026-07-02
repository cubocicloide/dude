import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { isDir } from '../../helpers.js'

const REQUIRED_FILES = [
  'Cargo.toml',
  'tauri.conf.json',
  'build.rs',
  path.join('src', 'main.rs'),
  path.join('src', 'lib.rs'),
  path.join('src', 'error.rs'),
  path.join('src', 'state.rs'),
  path.join('src', 'commands', 'mod.rs'),
]

const REQUIRED_DIRS = ['capabilities', path.join('src', 'commands')]

/** BE001 — required src-tauri/ layout (entry points, shared error/state, commands/, capabilities/) */
export default function check(root: string): RawDiagnostic[] {
  const tauriDir = path.join(root, 'src-tauri')
  if (!existsSync(tauriDir)) {
    return [
      {
        file: 'src-tauri',
        line: 1,
        col: 1,
        severity: 'error',
        message: 'src-tauri/ directory is missing — this is not a Tauri project layout.',
      },
    ]
  }

  const diagnostics: RawDiagnostic[] = []
  for (const dir of REQUIRED_DIRS) {
    if (!isDir(path.join(tauriDir, dir))) {
      diagnostics.push({
        file: path.join('src-tauri', dir),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Required directory src-tauri/${dir}/ is missing.`,
      })
    }
  }
  for (const file of REQUIRED_FILES) {
    if (!existsSync(path.join(tauriDir, file))) {
      diagnostics.push({
        file: path.join('src-tauri', file),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Required file src-tauri/${file} is missing.`,
      })
    }
  }
  return diagnostics
}
