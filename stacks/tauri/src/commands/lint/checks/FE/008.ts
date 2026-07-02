import { readdirSync, existsSync } from 'node:fs'
import path from 'pathe'
import type { RawDiagnostic } from '@cubocicloide/dude'

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
  '.mp4',
  '.mp3',
  '.ogg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
])

/** FE008 — static assets must live exclusively in src/assets/ */
export default function check(root: string): RawDiagnostic[] {
  const srcDir = path.join(root, 'src')
  if (!existsSync(srcDir)) return []

  const assetsDir = path.join(srcDir, 'assets')
  const diagnostics: RawDiagnostic[] = []

  function walk(dir: string): void {
    if (dir === assetsDir) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        diagnostics.push({
          file: path.relative(root, fullPath),
          line: 1,
          col: 1,
          severity: 'error' as const,
          message: `Asset "${entry.name}" must be in src/assets/ (found in ${path.relative(root, dir)})`,
        })
      }
    }
  }

  walk(srcDir)
  return diagnostics
}
