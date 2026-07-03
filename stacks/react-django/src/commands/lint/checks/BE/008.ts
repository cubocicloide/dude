import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const APP_NAME_RE = /^app_name\s*=\s*["'][\w-]+["']/m

function readSafe(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** BE008 — app urls.py must set app_name; config/urls.py must include each app's urls */
export default function check(root: string): RawDiagnostic[] {
  const appsDir = path.join(root, 'backend', 'apps')
  if (!existsSync(appsDir)) return []

  let entries
  try {
    entries = readdirSync(appsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const diagnostics: RawDiagnostic[] = []
  const appsWithUrls: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const urlsPath = path.join(appsDir, entry.name, 'urls.py')
    if (!existsSync(urlsPath)) continue
    appsWithUrls.push(entry.name)

    const content = readSafe(urlsPath)
    if (content === null) continue
    if (!APP_NAME_RE.test(content)) {
      diagnostics.push({
        file: path.join('backend', 'apps', entry.name, 'urls.py'),
        line: 1,
        col: 1,
        severity: 'error',
        message: `apps/${entry.name}/urls.py must define app_name = "${entry.name}" for URL namespacing`,
      })
    }
  }

  if (appsWithUrls.length === 0) return diagnostics

  const configUrlsPath = path.join(root, 'backend', 'config', 'urls.py')
  const configUrlsRel = path.join('backend', 'config', 'urls.py')
  const configContent = readSafe(configUrlsPath)

  if (configContent === null) {
    diagnostics.push({
      file: configUrlsRel,
      line: 1,
      col: 1,
      severity: 'error',
      message: 'backend/config/urls.py is missing — app URLconfs cannot be routed',
    })
    return diagnostics
  }

  for (const app of appsWithUrls) {
    if (!configContent.includes(`apps.${app}.urls`)) {
      diagnostics.push({
        file: configUrlsRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `config/urls.py must include("apps.${app}.urls") under the api/ prefix`,
      })
    }
  }

  return diagnostics
}
