import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const PAGE_TS = /^[A-Z][a-zA-Z0-9]+Page\.ts$/

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

/** ET004 — page object files must follow the *Page.ts naming convention */
export default function check(root: string): RawDiagnostic[] {
  const pagesDir = path.join(root, 'e2e', 'pages')
  if (!existsSync(pagesDir)) return []

  const diagnostics: RawDiagnostic[] = []

  for (const file of collectFiles(pagesDir, '.ts')) {
    const name = path.basename(file)
    if (name === 'index.ts') continue
    if (!PAGE_TS.test(name)) {
      diagnostics.push({
        file: path.relative(root, file),
        line: 1,
        col: 1,
        severity: 'error',
        message: `Page object "${name}" must follow the *Page.ts convention (e.g. LoginPage.ts).`,
      })
    }
  }

  return diagnostics
}
