import { readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf } from '../../helpers.js'

const EVENT_IMPORT_RE = /from\s+['"]@tauri-apps\/api\/event['"]/g

/**
 * FE010 — Tauri event subscriptions must go through the useTauriEvent hook.
 * Importing `@tauri-apps/api/event` (listen/once/emit) anywhere except
 * src/hooks/ or src/ipc/ risks leaked listeners: `listen()` resolves to an
 * async unlisten function that components routinely forget to await/call.
 */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = path.join(root, 'src')
  const hooksDir = path.join(srcDir, 'hooks')
  const ipcDir = path.join(srcDir, 'ipc')

  const files = collectFiles(srcDir, (n) => n.endsWith('.ts') || n.endsWith('.tsx')).filter(
    (f) => !f.startsWith(hooksDir + '/') && !f.startsWith(ipcDir + '/'),
  )

  const diagnostics: RawDiagnostic[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const m of content.matchAll(EVENT_IMPORT_RE)) {
      diagnostics.push({
        file: path.relative(root, file),
        line: lineOf(content, m.index ?? 0),
        col: 1,
        severity: 'error',
        message:
          'Direct import of "@tauri-apps/api/event" outside src/hooks/ (or src/ipc/). Subscribe via the useTauriEvent hook so the listener is cleaned up on unmount.',
      })
    }
  }
  return diagnostics
}
