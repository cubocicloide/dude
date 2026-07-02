import { existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { readText } from '../../helpers.js'

/**
 * BE009 — tauri.conf.json hygiene: a real bundle identifier (not the
 * com.tauri.dev default) and a non-null Content-Security-Policy. A null CSP
 * disables the webview's main injection defence.
 */
export default function check(root: string): RawDiagnostic[] {
  const confFile = path.join(root, 'src-tauri', 'tauri.conf.json')
  if (!existsSync(confFile)) return []

  const rel = path.join('src-tauri', 'tauri.conf.json')
  let conf: Record<string, unknown>
  try {
    conf = JSON.parse(readText(confFile)) as Record<string, unknown>
  } catch (e) {
    return [
      {
        file: rel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `tauri.conf.json is not valid JSON: ${(e as Error).message}`,
      },
    ]
  }

  const diagnostics: RawDiagnostic[] = []

  const identifier = String(conf.identifier ?? '')
  if (identifier === '' || identifier === 'com.tauri.dev' || identifier === 'com.tauri.app') {
    diagnostics.push({
      file: rel,
      line: 1,
      col: 1,
      severity: 'error',
      message: `Bundle identifier "${identifier || '(empty)'}" is a placeholder — set a real reverse-domain identifier (e.g. com.acme.myapp).`,
    })
  } else if (/[^a-zA-Z0-9.]/.test(identifier)) {
    // Android package names forbid dashes; Apple bundle IDs forbid underscores.
    // Alphanumeric dot-separated segments are the portable intersection.
    diagnostics.push({
      file: rel,
      line: 1,
      col: 1,
      severity: 'warning',
      message: `Bundle identifier "${identifier}" is not mobile-portable — Android forbids dashes and Apple forbids underscores. Use alphanumeric dot-separated segments (e.g. com.acme.myapp) before running \`dude android|ios init\`.`,
    })
  }

  const app = (conf.app ?? {}) as Record<string, unknown>
  const security = (app.security ?? {}) as Record<string, unknown>
  if (!('csp' in security) || security.csp == null) {
    diagnostics.push({
      file: rel,
      line: 1,
      col: 1,
      severity: 'error',
      message:
        'app.security.csp is null or missing — define a Content-Security-Policy (Tauri augments it with its own directives at runtime).',
    })
  }
  return diagnostics
}
