import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

/**
 * BE011 — every command module must ship unit tests: a #[cfg(test)] mod at
 * the bottom of the file, exercising the domain logic (keep commands thin so
 * the logic is testable without a running app).
 */
export default function check(root: string): RawDiagnostic[] {
  const commandsDir = path.join(root, 'src-tauri', 'src', 'commands')
  if (!existsSync(commandsDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.rs') || entry.name === 'mod.rs') continue
    const content = readFileSync(path.join(commandsDir, entry.name), 'utf8')
    if (!content.includes('#[cfg(test)]')) {
      diagnostics.push({
        file: path.join('src-tauri', 'src', 'commands', entry.name),
        line: 1,
        col: 1,
        severity: 'warning',
        message: `Command module "${entry.name}" has no #[cfg(test)] tests — add unit tests for its logic.`,
      })
    }
  }
  return diagnostics
}
