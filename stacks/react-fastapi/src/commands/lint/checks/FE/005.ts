import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import {
  DYNAMIC_SEGMENT,
  KEBAB_CASE,
  SCOPE_FILES,
  SCOPE_FILES_LABEL,
  diag,
  frontendSrc,
} from '../../frontend-structure'

const ALLOWED_DIRS = new Set(['$components', '$hooks', '$assets', '$misc'])
/** Unprefixed names that would shadow the privileged directories. */
const RESERVED_SEGMENTS = new Set(['components', 'hooks', 'assets', 'misc'])

/** FE005 — page dirs contain only scope files + privileged dirs; route segments are kebab-case or [param] */
export default function check(root: string): RawDiagnostic[] {
  const pagesDir = path.join(frontendSrc(root), 'pages')
  if (!existsSync(pagesDir)) return []

  const results: RawDiagnostic[] = []

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)

      if (!entry.isDirectory()) {
        if (!SCOPE_FILES.has(entry.name)) {
          results.push(
            diag(
              root,
              entryPath,
              'warning',
              `Unexpected file "${entry.name}" in page directory. Allowed: ${SCOPE_FILES_LABEL}`,
            ),
          )
        }
        continue
      }

      if (entry.name.startsWith('$')) {
        if (!ALLOWED_DIRS.has(entry.name)) {
          results.push(
            diag(
              root,
              entryPath,
              'error',
              `Unknown privileged directory "${entry.name}" in page directory. Allowed: $components/, $hooks/, $assets/, $misc/`,
            ),
          )
        }
        continue
      }

      // Any other directory is a route segment.
      if (RESERVED_SEGMENTS.has(entry.name)) {
        results.push(
          diag(
            root,
            entryPath,
            'error',
            `Route segment "${entry.name}" conflicts with the structural directories — use the privileged "$${entry.name}" folder, or pick a different route name`,
          ),
        )
      } else if (!KEBAB_CASE.test(entry.name) && !DYNAMIC_SEGMENT.test(entry.name)) {
        results.push(
          diag(
            root,
            entryPath,
            'error',
            `Route segment "${entry.name}" must be kebab-case (e.g. "user-settings") or a dynamic [param] segment (e.g. "[id]")`,
          ),
        )
      }

      const hasIndex = existsSync(path.join(entryPath, 'index.tsx'))
      const hasNestedRoutes = readdirSync(entryPath, { withFileTypes: true }).some(
        (e) => e.isDirectory() && !e.name.startsWith('$'),
      )
      if (!hasIndex && !hasNestedRoutes) {
        results.push(
          diag(
            root,
            entryPath,
            'warning',
            `Route directory "${entry.name}" has no index.tsx and no nested routes`,
          ),
        )
      }

      walk(entryPath)
    }
  }

  walk(pagesDir)
  return results
}
