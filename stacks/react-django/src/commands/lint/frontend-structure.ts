/**
 * Shared vocabulary for the FE lint checks (frontend `$`-structure).
 *
 * The frontend tree is organised in "scopes" (components, hooks, pages, utils
 * domains). Every scope owns the same file set (SCOPE_FILES) plus privileged
 * `$`-prefixed subdirectories ($components, $hooks, $assets, $misc). The `$`
 * prefix sorts these folders on top and makes them impossible to confuse with
 * a route segment or a domain name.
 *
 * Not a check module: it lives outside `checks/` so the runner never tries to
 * load it; tsup inlines it into each check entry.
 */
import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic, Severity } from '@cubocicloide/dude'

/** Files every scope (component, hook, page, utils domain) may contain. */
export const SCOPE_FILES = new Set([
  'index.tsx',
  'styles.module.css',
  'types.tsx',
  'constants.tsx',
  'functions.tsx',
])

/** Human-readable version of SCOPE_FILES for messages. */
export const SCOPE_FILES_LABEL = 'index.tsx, styles.module.css, types.tsx, constants.tsx, functions.tsx'

/** The full set of privileged directory names. */
export const PRIVILEGED_DIRS = new Set(['$components', '$hooks', '$assets', '$misc', '$types'])

export const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/
export const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
export const HOOK_NAME = /^use[A-Z][a-zA-Z0-9]*$/
/** Dynamic route segment: [id], [userId], … */
export const DYNAMIC_SEGMENT = /^\[[a-z][a-zA-Z0-9]*\]$/

export function frontendSrc(root: string): string {
  return path.join(root, 'frontend', 'src')
}

export function diag(
  root: string,
  absPath: string,
  severity: Severity,
  message: string,
): RawDiagnostic {
  return { file: path.relative(root, absPath), line: 1, col: 1, severity, message }
}

/**
 * Recursively collect directories named `name` under `dir`.
 * Never descends into `$misc` (exempt from checks) or `node_modules`,
 * but a `$misc` directory itself is still reported when it matches `name`.
 */
export function findDirsNamed(dir: string, name: string): string[] {
  const found: string[] = []
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.name === name) found.push(full)
    if (entry.name === '$misc') continue
    found.push(...findDirsNamed(full, name))
  }
  return found
}

/**
 * Collect page nodes under `pagesDir` as route paths relative to pages/
 * ('' = pages root). A page node is a directory whose index.tsx defines a
 * route. `$`-prefixed directories are structural, never route segments.
 */
export function collectPageNodes(pagesDir: string): string[] {
  const nodes: string[] = []
  if (!existsSync(pagesDir)) return nodes

  function walk(dir: string, route: string): void {
    if (existsSync(path.join(dir, 'index.tsx'))) nodes.push(route)
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('$')) continue
      walk(path.join(dir, entry.name), route === '' ? entry.name : `${route}/${entry.name}`)
    }
  }

  walk(pagesDir, '')
  return nodes
}
