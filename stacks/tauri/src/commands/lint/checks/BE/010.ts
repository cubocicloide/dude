import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { readText } from '../../helpers.js'

/**
 * BE010 — capability files must be valid, scoped and minimal: every
 * capabilities/*.json parses, targets explicit windows and lists explicit
 * permissions. Wildcard permission entries are flagged — grant exactly what
 * each window needs (principle of least privilege).
 */
export default function check(root: string): RawDiagnostic[] {
  const capsDir = path.join(root, 'src-tauri', 'capabilities')
  if (!existsSync(capsDir)) return []

  const diagnostics: RawDiagnostic[] = []
  for (const entry of readdirSync(capsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const rel = path.join('src-tauri', 'capabilities', entry.name)

    let cap: Record<string, unknown>
    try {
      cap = JSON.parse(readText(path.join(capsDir, entry.name))) as Record<string, unknown>
    } catch (e) {
      diagnostics.push({
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `Capability file is not valid JSON: ${(e as Error).message}`,
      })
      continue
    }

    if (typeof cap.identifier !== 'string' || cap.identifier === '') {
      diagnostics.push({
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message: 'Capability file must declare an "identifier".',
      })
    }
    const windows = cap.windows
    if (!Array.isArray(windows) || windows.length === 0) {
      diagnostics.push({
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message: 'Capability file must scope explicit "windows" (e.g. ["main"]).',
      })
    }
    const permissions = cap.permissions
    if (!Array.isArray(permissions) || permissions.length === 0) {
      diagnostics.push({
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message: 'Capability file must list explicit "permissions".',
      })
      continue
    }
    for (const perm of permissions) {
      const id = typeof perm === 'string' ? perm : String((perm as Record<string, unknown>).identifier ?? '')
      if (id.includes('*')) {
        diagnostics.push({
          file: rel,
          line: 1,
          col: 1,
          severity: 'warning',
          message: `Wildcard permission "${id}" — grant the specific permissions each window needs instead.`,
        })
      }
    }
  }
  return diagnostics
}
