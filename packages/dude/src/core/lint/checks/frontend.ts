import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import type { Diagnostic } from '../types.js'
import { Check } from '../types.js'

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/

/** FE001 — every directory inside components/ must be PascalCase */
export class ComponentNamingCheck extends Check {
  run(root: string): Diagnostic[] {
    const componentsDir = path.join(root, 'frontend', 'src', 'components')
    if (!existsSync(componentsDir)) return []

    return readdirSync(componentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => !PASCAL_CASE.test(e.name))
      .map((e) => ({
        file: path.join('frontend', 'src', 'components', e.name),
        line: 1,
        col: 1,
        severity: 'error',
        code: 'FE001',
        message: `Component directory "${e.name}" must be PascalCase`,
      }))
  }
}

/** FE002 — each component directory may only contain index.tsx, styles.module.css, types.tsx, components/ */
const ALLOWED_COMPONENT_ENTRIES = new Set(['index.tsx', 'styles.module.css', 'types.tsx', 'components'])

export class ComponentFilesCheck extends Check {
  run(root: string): Diagnostic[] {
    const componentsDir = path.join(root, 'frontend', 'src', 'components')
    if (!existsSync(componentsDir)) return []

    const diagnostics: Diagnostic[] = []
    for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(componentsDir, entry.name)
      for (const child of readdirSync(dir, { withFileTypes: true })) {
        if (!ALLOWED_COMPONENT_ENTRIES.has(child.name)) {
          diagnostics.push({
            file: path.join('frontend', 'src', 'components', entry.name, child.name),
            line: 1,
            col: 1,
            severity: 'warning',
            code: 'FE002',
            message: `Unexpected file "${child.name}" in component directory. Allowed: index.tsx, styles.module.css, types.tsx, components/`,
          })
        }
      }
    }
    return diagnostics
  }
}

/** FE003 — components/index.tsx must barrel-export all PascalCase children */
export class BarrelExportsCheck extends Check {
  run(root: string): Diagnostic[] {
    const componentsDir = path.join(root, 'frontend', 'src', 'components')
    const barrelFile = path.join(componentsDir, 'index.tsx')
    if (!existsSync(componentsDir) || !existsSync(barrelFile)) return []

    const pascalDirs = readdirSync(componentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && PASCAL_CASE.test(e.name))
      .map((e) => e.name)

    const barrelContent = readFileSync(barrelFile, 'utf8')
    const diagnostics: Diagnostic[] = []

    for (const name of pascalDirs) {
      // Accepts: export * from './Name' or export { ... } from './Name'
      if (!barrelContent.includes(`from './${name}'`) && !barrelContent.includes(`from "./${name}"`)) {
        diagnostics.push({
          file: path.join('frontend', 'src', 'components', 'index.tsx'),
          line: 1,
          col: 1,
          severity: 'error',
          code: 'FE003',
          message: `components/index.tsx is missing a barrel export for "${name}"`,
        })
      }
    }
    return diagnostics
  }
}

/** FE004 — imports in App.tsx must match dirs in pages/ 1-to-1 */
const PAGE_IMPORT_RE = /from\s+['"](?:@\/pages|\.\.?\/pages)\/([A-Za-z0-9_-]+)['"]/g

export class PageRoutesCheck extends Check {
  run(root: string): Diagnostic[] {
    const pagesDir = path.join(root, 'frontend', 'src', 'pages')
    const appFile = path.join(root, 'frontend', 'src', 'App.tsx')
    if (!existsSync(pagesDir) || !existsSync(appFile)) return []

    const pageDirs = new Set(
      readdirSync(pagesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name),
    )

    const appContent = readFileSync(appFile, 'utf8')
    const importedPages = new Set<string>()
    for (const m of appContent.matchAll(PAGE_IMPORT_RE)) {
      importedPages.add(m[1]!)
    }

    const diagnostics: Diagnostic[] = []
    const appRelPath = path.join('frontend', 'src', 'App.tsx')

    for (const imported of importedPages) {
      if (!pageDirs.has(imported)) {
        diagnostics.push({
          file: appRelPath,
          line: 1,
          col: 1,
          severity: 'error',
          code: 'FE004',
          message: `App.tsx imports page "${imported}" but pages/${imported}/ does not exist`,
        })
      }
    }
    for (const dir of pageDirs) {
      if (!importedPages.has(dir)) {
        diagnostics.push({
          file: path.join('frontend', 'src', 'pages', dir),
          line: 1,
          col: 1,
          severity: 'warning',
          code: 'FE004',
          message: `pages/${dir}/ exists but is not imported in App.tsx`,
        })
      }
    }
    return diagnostics
  }
}

/** FE005 — page dirs may only contain index.tsx, styles.module.css, types.tsx */
const ALLOWED_PAGE_ENTRIES = new Set(['index.tsx', 'styles.module.css', 'types.tsx'])

export class PageFilesCheck extends Check {
  run(root: string): Diagnostic[] {
    const pagesDir = path.join(root, 'frontend', 'src', 'pages')
    if (!existsSync(pagesDir)) return []

    const diagnostics: Diagnostic[] = []
    for (const entry of readdirSync(pagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(pagesDir, entry.name)
      for (const child of readdirSync(dir, { withFileTypes: true })) {
        if (!ALLOWED_PAGE_ENTRIES.has(child.name)) {
          diagnostics.push({
            file: path.join('frontend', 'src', 'pages', entry.name, child.name),
            line: 1,
            col: 1,
            severity: 'warning',
            code: 'FE005',
            message: `Unexpected file "${child.name}" in page directory. Allowed: index.tsx, styles.module.css, types.tsx`,
          })
        }
      }
    }
    return diagnostics
  }
}

/** FE006 — use* dirs in hooks/ may only contain index.tsx, types.tsx */
const ALLOWED_HOOK_ENTRIES = new Set(['index.tsx', 'types.tsx'])
const HOOK_DIR_RE = /^use[A-Z]/

export class HookFilesCheck extends Check {
  run(root: string): Diagnostic[] {
    const hooksDir = path.join(root, 'frontend', 'src', 'hooks')
    if (!existsSync(hooksDir)) return []

    const diagnostics: Diagnostic[] = []
    for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !HOOK_DIR_RE.test(entry.name)) continue
      const dir = path.join(hooksDir, entry.name)
      for (const child of readdirSync(dir, { withFileTypes: true })) {
        if (!ALLOWED_HOOK_ENTRIES.has(child.name)) {
          diagnostics.push({
            file: path.join('frontend', 'src', 'hooks', entry.name, child.name),
            line: 1,
            col: 1,
            severity: 'warning',
            code: 'FE006',
            message: `Unexpected file "${child.name}" in hook directory. Allowed: index.tsx, types.tsx`,
          })
        }
      }
    }
    return diagnostics
  }
}

/** FE007 — hooks/index.tsx must barrel-export all use* dirs */
export class HookBarrelCheck extends Check {
  run(root: string): Diagnostic[] {
    const hooksDir = path.join(root, 'frontend', 'src', 'hooks')
    const barrelFile = path.join(hooksDir, 'index.tsx')
    if (!existsSync(hooksDir) || !existsSync(barrelFile)) return []

    const hookDirs = readdirSync(hooksDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && HOOK_DIR_RE.test(e.name))
      .map((e) => e.name)

    const barrelContent = readFileSync(barrelFile, 'utf8')
    const diagnostics: Diagnostic[] = []

    for (const name of hookDirs) {
      if (!barrelContent.includes(`from './${name}'`) && !barrelContent.includes(`from "./${name}"`)) {
        diagnostics.push({
          file: path.join('frontend', 'src', 'hooks', 'index.tsx'),
          line: 1,
          col: 1,
          severity: 'error',
          code: 'FE007',
          message: `hooks/index.tsx is missing a barrel export for "${name}"`,
        })
      }
    }
    return diagnostics
  }
}
