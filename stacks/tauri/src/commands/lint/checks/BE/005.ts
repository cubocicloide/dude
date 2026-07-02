import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { findTauriCommands, readText } from '../../helpers.js'

/**
 * BE005 — invoke_handler parity: every #[tauri::command] function defined in
 * commands/ must be registered in the generate_handler![…] list in lib.rs, and
 * every registered entry must exist. A command missing from the list compiles
 * fine but fails at runtime with "command not found" — this catches it early.
 */
export default function check(root: string): RawDiagnostic[] {
  const commandsDir = path.join(root, 'src-tauri', 'src', 'commands')
  const libFile = path.join(root, 'src-tauri', 'src', 'lib.rs')
  if (!existsSync(commandsDir) || !existsSync(libFile)) return []

  // Defined commands: name → file.
  const defined = new Map<string, string>()
  for (const entry of readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.rs')) continue
    const content = readFileSync(path.join(commandsDir, entry.name), 'utf8')
    for (const cmd of findTauriCommands(content)) {
      defined.set(cmd.name, path.join('src-tauri', 'src', 'commands', entry.name))
    }
  }

  // Registered commands: last path segment of each generate_handler! entry.
  const lib = readText(libFile)
  const handlerMatch = lib.match(/generate_handler!\s*\[([\s\S]*?)\]/)
  const libRel = path.join('src-tauri', 'src', 'lib.rs')

  if (handlerMatch == null) {
    return [
      {
        file: libRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: 'lib.rs has no tauri::generate_handler![…] list — commands cannot be invoked.',
      },
    ]
  }

  const registered = new Set(
    handlerMatch[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split('::').pop()!),
  )

  const diagnostics: RawDiagnostic[] = []
  for (const [name, file] of defined) {
    if (!registered.has(name)) {
      diagnostics.push({
        file,
        line: 1,
        col: 1,
        severity: 'error',
        message: `Command "${name}" is defined but not registered in generate_handler![…] in lib.rs — invoke('${name}') will fail at runtime.`,
      })
    }
  }
  for (const name of registered) {
    if (!defined.has(name)) {
      diagnostics.push({
        file: libRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `generate_handler![…] registers "${name}" but no #[tauri::command] with that name exists under commands/.`,
      })
    }
  }
  return diagnostics
}
