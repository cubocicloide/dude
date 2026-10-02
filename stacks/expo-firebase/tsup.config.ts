import { defineConfig } from 'tsup'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function lintCheckEntries(): Record<string, string> {
  const checksDir = join(__dirname, 'src', 'commands', 'lint', 'checks')
  if (!existsSync(checksDir)) return {}

  const entries: Record<string, string> = {}
  for (const group of readdirSync(checksDir)) {
    const groupDir = join(checksDir, group)
    for (const file of readdirSync(groupDir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
      const id = file.replace(/\.ts$/, '')
      entries[`commands/lint/checks/${group}/${id}`] = `src/commands/lint/checks/${group}/${file}`
    }
  }
  return entries
}

export default defineConfig({
  entry: { index: 'src/index.ts', ...lintCheckEntries() },
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['@cubocicloide/dude', 'pathe'],
})
