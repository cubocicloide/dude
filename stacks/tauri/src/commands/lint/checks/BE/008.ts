import { readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf, stripLineComments, stripRustTests } from '../../helpers.js'

const PRINT_RE = /\b(println!|eprintln!|print!|eprint!|dbg!)\s*\(/g

/**
 * BE008 — no print-family macros in src-tauri/src (outside #[cfg(test)]).
 * A packaged desktop app has no console: use the log crate macros
 * (log::info!, log::warn!, …) which tauri-plugin-log routes to file/webview.
 */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = path.join(root, 'src-tauri', 'src')

  const diagnostics: RawDiagnostic[] = []
  for (const file of collectFiles(srcDir, (n) => n.endsWith('.rs'), new Set(['target']))) {
    const content = stripLineComments(stripRustTests(readFileSync(file, 'utf8')))
    for (const m of content.matchAll(PRINT_RE)) {
      diagnostics.push({
        file: path.relative(root, file),
        line: lineOf(content, m.index ?? 0),
        col: 1,
        severity: 'warning',
        message: `${m[1]} writes to a console the packaged app doesn't have — use log::info!/log::warn! (tauri-plugin-log) instead.`,
      })
    }
  }
  return diagnostics
}
