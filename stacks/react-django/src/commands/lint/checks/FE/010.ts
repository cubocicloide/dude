import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { diag, frontendSrc } from '../../frontend-structure'

const ALLOWED_ROOT_FILES = new Set(['App.tsx', 'main.tsx', 'styles.module.css'])
const ALLOWED_ROOT_DIRS = new Set(['$types', '$components', '$hooks', 'openapi', 'pages', 'utils'])

/** Legacy layout entries and where their content belongs now. */
const LEGACY_ENTRIES = new Map([
  ['components', 'move it to $components/'],
  ['hooks', 'move it to $hooks/'],
  ['assets', 'move each asset into the $assets/ folder of its owning scope'],
  ['index.css', 'rename it to styles.module.css'],
  ['vite-env.d.ts', 'move it to $types/vite-env.d.ts'],
])

/** FE010 — src root contains only the app entry files + $types/$components/$hooks/openapi/pages/utils; *.d.ts live in $types/ */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = frontendSrc(root)
  if (!existsSync(srcDir)) return []

  const results: RawDiagnostic[] = []

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const entryPath = path.join(srcDir, entry.name)
    const legacyHint = LEGACY_ENTRIES.get(entry.name)
    if (legacyHint) {
      results.push(
        diag(
          root,
          entryPath,
          'error',
          `"${entry.name}" belongs to the legacy frontend layout — ${legacyHint}`,
        ),
      )
      continue
    }
    if (entry.isDirectory()) {
      if (!ALLOWED_ROOT_DIRS.has(entry.name)) {
        results.push(
          diag(
            root,
            entryPath,
            'error',
            `Unexpected directory "${entry.name}" at src root. Allowed: $types/, $components/, $hooks/, openapi/, pages/, utils/`,
          ),
        )
      }
    } else if (!ALLOWED_ROOT_FILES.has(entry.name)) {
      results.push(
        diag(
          root,
          entryPath,
          'error',
          `Unexpected file "${entry.name}" at src root. Allowed: App.tsx, main.tsx, styles.module.css`,
        ),
      )
    }
  }

  // $types/ may only contain *.d.ts files…
  const typesDir = path.join(srcDir, '$types')
  if (existsSync(typesDir)) {
    for (const entry of readdirSync(typesDir, { withFileTypes: true })) {
      if (entry.isDirectory() || !entry.name.endsWith('.d.ts')) {
        results.push(
          diag(
            root,
            path.join(typesDir, entry.name),
            'error',
            `"${entry.name}" is not allowed in $types/ — the folder may only contain *.d.ts declaration files`,
          ),
        )
      }
    }
  }

  // …and every *.d.ts must live there.
  function findStrayDts(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '$misc' || entry.name === '$types' || entry.name === 'node_modules')
          continue
        findStrayDts(entryPath)
      } else if (entry.name.endsWith('.d.ts')) {
        results.push(
          diag(
            root,
            entryPath,
            'error',
            `Type declaration "${entry.name}" must live in frontend/src/$types/`,
          ),
        )
      }
    }
  }
  findStrayDts(srcDir)

  return results
}
