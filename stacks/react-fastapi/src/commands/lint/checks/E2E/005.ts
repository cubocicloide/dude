import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

// Matches: from '../pages/LoginPage'  or  from '@pages/LoginPage'
const PAGE_IMPORT_RE = /from\s+['"][^'"]*pages\/([A-Za-z0-9]+Page)['"]/g

function collectFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...collectFiles(full, ext))
    else if (entry.name.endsWith(ext)) results.push(full)
  }
  return results
}

/** ET005 — page objects imported in step files must exist under e2e/pages/ */
export default function check(root: string): RawDiagnostic[] {
  const stepsDir = path.join(root, 'e2e', 'steps')
  const pagesDir = path.join(root, 'e2e', 'pages')

  if (!existsSync(stepsDir) || !existsSync(pagesDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const file of collectFiles(stepsDir, '.steps.ts')) {
    let content: string
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }

    for (const match of content.matchAll(PAGE_IMPORT_RE)) {
      const pageClass = match[1] // e.g. "LoginPage"
      const expected = path.join(pagesDir, `${pageClass}.ts`)
      if (!existsSync(expected)) {
        const line = content.slice(0, match.index).split('\n').length
        diagnostics.push({
          file: path.relative(root, file),
          line,
          col: 1,
          severity: 'error',
          message: `Imported page object "${pageClass}" not found. Expected: e2e/pages/${pageClass}.ts`,
        })
      }
    }
  }

  return diagnostics
}
