import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'
import { KEBAB_CASE, diag, frontendSrc } from '../../frontend-structure'

/** Non-code file extensions that belong in a $assets/ directory. */
const ASSET_EXTENSIONS = new Set([
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.pdf',
  '.json',
  '.txt',
  '.csv',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
  '.ogg',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
])

/** kebab-case base name (dots allowed as extra separators), lowercase extension. */
const ASSET_NAME = /^[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z0-9]+$/

/** FE008 — static assets live only in $assets/ folders; $assets/ contains only kebab-case asset files */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = frontendSrc(root)
  if (!existsSync(srcDir)) return []

  const results: RawDiagnostic[] = []

  function walkAssets(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!KEBAB_CASE.test(entry.name)) {
          results.push(
            diag(
              root,
              entryPath,
              'warning',
              `Asset subdirectory "${entry.name}" should be kebab-case`,
            ),
          )
        }
        walkAssets(entryPath)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!ASSET_EXTENSIONS.has(ext)) {
        results.push(
          diag(
            root,
            entryPath,
            'error',
            `"${entry.name}" is not a static asset — $assets/ may only contain asset files (images, fonts, media, documents, data), never code`,
          ),
        )
      } else if (!ASSET_NAME.test(entry.name)) {
        results.push(
          diag(
            root,
            entryPath,
            'warning',
            `Asset "${entry.name}" should be kebab-case with a lowercase extension (e.g. "user-guide.pdf")`,
          ),
        )
      }
    }
  }

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '$misc' || entry.name === 'node_modules') continue
        if (entry.name === '$assets') {
          walkAssets(entryPath)
        } else {
          walk(entryPath)
        }
        continue
      }
      if (ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(
          diag(
            root,
            entryPath,
            'error',
            `Asset "${entry.name}" must live in a $assets/ directory of its owning scope (found in ${path.relative(root, dir)})`,
          ),
        )
      }
    }
  }

  walk(srcDir)
  return results
}
