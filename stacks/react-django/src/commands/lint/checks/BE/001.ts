import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const BASE_SETTINGS_REL = 'backend/config/settings/base.py'

/** Directories under backend/apps/ that contain an apps.py (i.e. real Django apps). */
function listApps(root: string): string[] {
  const appsDir = path.join(root, 'backend', 'apps')
  try {
    return readdirSync(appsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(appsDir, e.name, 'apps.py')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * Extract the LOCAL_APPS list block from base.py.
 * Returns the entries as {name, line} plus the 1-based line the list starts on.
 */
function parseLocalApps(
  lines: string[],
): { entries: Array<{ name: string; line: number }>; startLine: number } | null {
  const start = lines.findIndex((l) => /^LOCAL_APPS\s*(?::[^=]*)?=\s*\[/.test(l))
  if (start === -1) return null

  const entries: Array<{ name: string; line: number }> = []
  let depth = 0
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!
    for (const m of line.matchAll(/["']apps\.([A-Za-z_]\w*)/g)) {
      entries.push({ name: m[1]!, line: i + 1 })
    }
    for (const ch of line) {
      if (ch === '[') depth++
      else if (ch === ']') depth--
    }
    if (depth <= 0 && i > start) break
    if (depth === 0 && i === start && line.includes(']')) break
  }
  return { entries, startLine: start + 1 }
}

/** BE001 — every backend/apps/<name>/ (with apps.py) ↔ "apps.<name>" in LOCAL_APPS */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'backend', 'apps')
  if (!existsSync(appsDir)) return []

  const diskApps = listApps(root)
  const basePath = path.join(root, 'backend', 'config', 'settings', 'base.py')

  let content: string
  try {
    content = readFileSync(basePath, 'utf8')
  } catch {
    if (diskApps.length === 0) return []
    return [
      {
        file: BASE_SETTINGS_REL,
        line: 1,
        col: 1,
        severity: 'error',
        message:
          'backend/config/settings/base.py is missing — cannot verify LOCAL_APPS registration',
      },
    ]
  }

  const parsed = parseLocalApps(content.split('\n'))
  if (!parsed) {
    return [
      {
        file: BASE_SETTINGS_REL,
        line: 1,
        col: 1,
        severity: 'error',
        message: 'LOCAL_APPS list not found in config/settings/base.py',
      },
    ]
  }

  const diagnostics: RawDiagnostic[] = []
  const registered = new Set(parsed.entries.map((e) => e.name))

  for (const app of diskApps) {
    if (!registered.has(app)) {
      diagnostics.push({
        file: BASE_SETTINGS_REL,
        line: parsed.startLine,
        col: 1,
        severity: 'error',
        message: `App "apps.${app}" (backend/apps/${app}/) is not registered in LOCAL_APPS`,
      })
    }
  }

  const onDisk = new Set(diskApps)
  for (const entry of parsed.entries) {
    if (!onDisk.has(entry.name)) {
      diagnostics.push({
        file: BASE_SETTINGS_REL,
        line: entry.line,
        col: 1,
        severity: 'error',
        message: `LOCAL_APPS entry "apps.${entry.name}" has no matching backend/apps/${entry.name}/ directory (with apps.py)`,
      })
    }
  }

  return diagnostics
}
