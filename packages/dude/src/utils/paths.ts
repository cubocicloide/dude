import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'pathe'

/**
 * Returns the absolute path of the `@cubocicloide/dude` package root
 * (the directory containing `package.json`). Works whether the CLI is
 * executed from `dist/` or via `tsx` against source files.
 */
export function getPackageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  // src/utils → src → package root
  // dist     → package root (tsup flattens entries)
  // Walk up until we find a package.json with the right name.
  let current = here
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(current, 'package.json'), 'utf8')) as {
        name?: string
      }
      if (pkg.name === '@cubocicloide/dude') return current
    } catch {
      /* keep walking */
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return here
}

let cachedVersion: string | null = null

export function getCliVersion(): string {
  if (cachedVersion) return cachedVersion
  try {
    const pkg = JSON.parse(readFileSync(path.join(getPackageRoot(), 'package.json'), 'utf8')) as {
      version: string
    }
    cachedVersion = pkg.version
  } catch {
    cachedVersion = '0.0.0'
  }
  return cachedVersion
}
