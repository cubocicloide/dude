import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { readText } from '../../helpers.js'

/**
 * BE002 — main.rs must stay thin: it only delegates to the library crate
 * (`app_lib::run()`). All setup (plugins, state, handlers) lives in lib.rs so
 * it is shared with mobile entry points and testable.
 */
export default function check(root: string): RawDiagnostic[] {
  const mainFile = path.join(root, 'src-tauri', 'src', 'main.rs')
  if (!existsSync(mainFile)) return []

  const content = readText(mainFile)
  const rel = path.join('src-tauri', 'src', 'main.rs')
  const diagnostics: RawDiagnostic[] = []

  if (!content.includes('app_lib::run()')) {
    diagnostics.push({
      file: rel,
      line: 1,
      col: 1,
      severity: 'error',
      message: 'main.rs must delegate to the library crate: fn main() { app_lib::run() }.',
    })
  }
  if (content.includes('#[tauri::command]')) {
    diagnostics.push({
      file: rel,
      line: 1,
      col: 1,
      severity: 'error',
      message: 'main.rs must not define Tauri commands — move them to src/commands/.',
    })
  }
  if (content.includes('tauri::Builder')) {
    diagnostics.push({
      file: rel,
      line: 1,
      col: 1,
      severity: 'error',
      message: 'main.rs must not build the Tauri app — the Builder belongs in lib.rs (run()).',
    })
  }
  return diagnostics
}
