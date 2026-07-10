import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { collectPageNodes, diag, frontendSrc } from '../../frontend-structure'

const PAGE_IMPORT_RE = /from\s+['"](?:@|\.\.?)\/pages((?:\/[^'"]+)?)['"]/g

/** FE004 — imports of @/pages/... in App.tsx must match page nodes (dirs with index.tsx) 1-to-1 */
export default function check(root: string): RawDiagnostic[] {
  const src = frontendSrc(root)
  const pagesDir = path.join(src, 'pages')
  const appFile = path.join(src, 'App.tsx')
  if (!existsSync(pagesDir) || !existsSync(appFile)) return []

  const pageNodes = new Set(collectPageNodes(pagesDir))

  const appContent = readFileSync(appFile, 'utf8')
  const importedPages = new Set<string>()
  for (const m of appContent.matchAll(PAGE_IMPORT_RE)) {
    importedPages.add(m[1]!.replace(/^\//, ''))
  }

  const results: RawDiagnostic[] = []
  const label = (route: string) => (route === '' ? 'pages' : `pages/${route}`)

  for (const imported of importedPages) {
    if (!pageNodes.has(imported)) {
      results.push(
        diag(
          root,
          appFile,
          'error',
          `App.tsx imports page "@/pages${imported ? `/${imported}` : ''}" but frontend/src/${label(imported)}/index.tsx does not exist`,
        ),
      )
    }
  }
  for (const route of pageNodes) {
    if (!importedPages.has(route)) {
      results.push(
        diag(
          root,
          path.join(pagesDir, route),
          'warning',
          `${label(route)}/index.tsx exists but is not imported in App.tsx`,
        ),
      )
    }
  }
  return results
}
