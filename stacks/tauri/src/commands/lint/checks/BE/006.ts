import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { lineOf } from '../../helpers.js'

// Matches a command attribute followed by its fn signature up to the return type.
const COMMAND_FN_RE =
  /#\[tauri::command[^\]]*\]\s*(?:#\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)\s*(?:->\s*([^{]+))?\{/g

/**
 * BE006 — fallible commands must return the shared error type:
 * `Result<T, AppError>`. Stringly-typed errors (`Result<T, String>`) lose
 * structure and make frontend error handling inconsistent.
 */
export default function check(root: string): RawDiagnostic[] {
  const commandsDir = path.join(root, 'src-tauri', 'src', 'commands')
  if (!existsSync(commandsDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.rs')) continue
    const content = readFileSync(path.join(commandsDir, entry.name), 'utf8')
    const rel = path.join('src-tauri', 'src', 'commands', entry.name)

    for (const m of content.matchAll(COMMAND_FN_RE)) {
      const name = m[1]!
      const returnType = (m[3] ?? '').trim()
      if (returnType.startsWith('Result') && !returnType.includes('AppError')) {
        diagnostics.push({
          file: rel,
          line: lineOf(content, m.index ?? 0),
          col: 1,
          severity: 'error',
          message: `Command "${name}" returns "${returnType}" — fallible commands must return Result<_, AppError> (see src-tauri/src/error.rs).`,
        })
      }
    }
  }
  return diagnostics
}
