import { readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, findTauriCommands } from '../../helpers.js'

/**
 * BE003 — every #[tauri::command] must live in a module under
 * src-tauri/src/commands/ (one file per domain), never in lib.rs, main.rs or
 * elsewhere.
 */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = path.join(root, 'src-tauri', 'src')
  const commandsDir = path.join(srcDir, 'commands')

  const files = collectFiles(srcDir, (n) => n.endsWith('.rs'), new Set(['target'])).filter(
    (f) => !f.startsWith(commandsDir + '/'),
  )

  const diagnostics: RawDiagnostic[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const cmd of findTauriCommands(content)) {
      diagnostics.push({
        file: path.relative(root, file),
        line: cmd.line,
        col: 1,
        severity: 'error',
        message: `Tauri command "${cmd.name}" defined outside src-tauri/src/commands/. Move it to a domain module (e.g. commands/${cmd.name}.rs).`,
      })
    }
  }
  return diagnostics
}
