import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { lineOf, stripLineComments, stripRustTests } from '../../helpers.js'

const PANIC_RE = /\.(unwrap|expect)\s*\(/g

/**
 * BE007 — no .unwrap()/.expect() in command modules (outside #[cfg(test)]).
 * A panic inside a command crashes the whole app process; propagate errors
 * with `?` into the shared AppError instead.
 */
export default function check(root: string): RawDiagnostic[] {
  const commandsDir = path.join(root, 'src-tauri', 'src', 'commands')
  if (!existsSync(commandsDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.rs')) continue
    const raw = readFileSync(path.join(commandsDir, entry.name), 'utf8')
    const content = stripLineComments(stripRustTests(raw))

    for (const m of content.matchAll(PANIC_RE)) {
      diagnostics.push({
        file: path.join('src-tauri', 'src', 'commands', entry.name),
        line: lineOf(content, m.index ?? 0),
        col: 1,
        severity: 'warning',
        message: `.${m[1]}() panics on failure and crashes the app — propagate the error with \`?\` into AppError instead.`,
      })
    }
  }
  return diagnostics
}
