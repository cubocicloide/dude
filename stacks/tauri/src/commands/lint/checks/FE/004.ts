import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

const PAGE_IMPORT_RE = /from\s+['"](?:@\/pages|\.\.?\/pages)\/([A-Za-z0-9_-]+)['"]/g

/** FE004 — imports in App.tsx must match dirs in pages/ 1-to-1 */
export default function check(root: string): RawDiagnostic[] {
  const pagesDir = path.join(root, 'src', 'pages')
  const appFile = path.join(root, 'src', 'App.tsx')
  if (!existsSync(pagesDir) || !existsSync(appFile)) return []

  const pageDirs = new Set(
    readdirSync(pagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  )

  const appContent = readFileSync(appFile, 'utf8')
  const importedPages = new Set<string>()
  for (const m of appContent.matchAll(PAGE_IMPORT_RE)) importedPages.add(m[1]!)

  const diagnostics: RawDiagnostic[] = []
  const appRel = path.join('src', 'App.tsx')

  for (const imported of importedPages) {
    if (!pageDirs.has(imported)) {
      diagnostics.push({
        file: appRel,
        line: 1,
        col: 1,
        severity: 'error',
        message: `App.tsx imports page "${imported}" but pages/${imported}/ does not exist`,
      })
    }
  }
  for (const dir of pageDirs) {
    if (!importedPages.has(dir)) {
      diagnostics.push({
        file: path.join('src', 'pages', dir),
        line: 1,
        col: 1,
        severity: 'warning',
        message: `pages/${dir}/ exists but is not imported in App.tsx`,
      })
    }
  }
  return diagnostics
}
