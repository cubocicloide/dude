import { readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectFiles, lineOf } from '../../helpers.js'

const CORE_IMPORT_RE = /from\s+['"]@tauri-apps\/api\/core['"]/g
const GLOBAL_TAURI_RE = /window\.__TAURI__/g

/**
 * FE009 — all IPC must go through the typed wrappers in src/ipc/.
 * No component, page or hook may import `@tauri-apps/api/core` (invoke)
 * directly, and the injected `window.__TAURI__` global must never be used.
 */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = path.join(root, 'src')
  const ipcDir = path.join(srcDir, 'ipc')

  const files = collectFiles(srcDir, (n) => n.endsWith('.ts') || n.endsWith('.tsx')).filter(
    (f) => !f.startsWith(ipcDir + '/'),
  )

  const diagnostics: RawDiagnostic[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const rel = path.relative(root, file)

    for (const m of content.matchAll(CORE_IMPORT_RE)) {
      diagnostics.push({
        file: rel,
        line: lineOf(content, m.index ?? 0),
        col: 1,
        severity: 'error',
        message:
          'Direct import of "@tauri-apps/api/core" outside src/ipc/. Call the typed wrapper from src/ipc/ instead (one module per command domain).',
      })
    }
    for (const m of content.matchAll(GLOBAL_TAURI_RE)) {
      diagnostics.push({
        file: rel,
        line: lineOf(content, m.index ?? 0),
        col: 1,
        severity: 'error',
        message:
          'Do not use the window.__TAURI__ global. Import from "@tauri-apps/api" inside src/ipc/ wrappers instead.',
      })
    }
  }
  return diagnostics
}
