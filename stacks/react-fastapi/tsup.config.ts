import { defineConfig } from 'tsup'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Auto-discover lint check source files under src/lint/checks/{GROUP}/{id}.ts
 * and emit each as a separate output file so the `dude lint` runner can
 * dynamic-import them individually at runtime.
 *
 * Convention: src/lint/checks/FE/001.ts → dist/lint/checks/FE/001.js → code "FE001"
 */
function lintCheckEntries(): Record<string, string> {
  const checksDir = join(__dirname, 'src', 'commands', 'lint', 'checks')
  if (!existsSync(checksDir)) return {}

  const entries: Record<string, string> = {}
  for (const group of readdirSync(checksDir)) {
    const groupDir = join(checksDir, group)
    for (const file of readdirSync(groupDir)) {
      if (!file.endsWith('.ts')) continue
      const id = file.replace(/\.ts$/, '')
      entries[`commands/lint/checks/${group}/${id}`] = `src/commands/lint/checks/${group}/${file}`
    }
  }
  return entries
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ...lintCheckEntries(),
  },
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['@cubocicloide/dude', 'openapi-typescript', 'pathe', 'yaml'],
})
