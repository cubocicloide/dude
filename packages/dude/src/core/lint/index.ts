import { readdirSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import type { Diagnostic, CheckFn } from './types.js'
import { formatDiagnostic } from './types.js'

export interface LintResult {
  diagnostics: Diagnostic[]
  errorCount: number
  warningCount: number
}

/**
 * Scan {stackRoot}/dist/lint/checks/{GROUP}/{id}.js, derive code = GROUP+id,
 * dynamically import each check function, run against `root`, and collect
 * diagnostics with the code injected from the path.
 */
export async function runLint(root: string, stackRoot: string): Promise<LintResult> {
  const checksDir = path.join(stackRoot, 'dist', 'commands', 'lint', 'checks')

  if (!existsSync(checksDir)) {
    throw new Error(
      `No lint checks directory found at:\n  ${checksDir}\n` +
        `Did you build the stack? Try: pnpm --filter <stack> build`,
    )
  }

  const all: Diagnostic[] = []

  for (const groupEntry of readdirSync(checksDir, { withFileTypes: true })) {
    if (!groupEntry.isDirectory()) continue
    const group = groupEntry.name

    for (const fileEntry of readdirSync(path.join(checksDir, group), { withFileTypes: true })) {
      if (!fileEntry.isFile() || !fileEntry.name.endsWith('.js')) continue

      const id = fileEntry.name.replace(/\.js$/, '')
      const code = `${group}${id}`
      const filePath = path.join(checksDir, group, fileEntry.name)

      const mod = (await import(pathToFileURL(filePath).href)) as { default?: CheckFn }
      if (typeof mod.default !== 'function') {
        throw new Error(`Lint check ${code} (${filePath}) must export a default function.`)
      }

      const raw = await mod.default(root)
      for (const d of raw) {
        all.push({ ...d, code })
      }
    }
  }

  all.sort((a, b) => {
    const f = a.file.localeCompare(b.file)
    if (f !== 0) return f
    if (a.line !== b.line) return a.line - b.line
    return a.col - b.col
  })

  return {
    diagnostics: all,
    errorCount: all.filter((d) => d.severity === 'error').length,
    warningCount: all.filter((d) => d.severity === 'warning').length,
  }
}

export { formatDiagnostic }
export type { Diagnostic }
