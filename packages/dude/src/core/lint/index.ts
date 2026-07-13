/**
 * Lint engine shared by every stack.
 *
 * Checks come from two sources, run through the same contract
 * (`CheckFn = (root) => RawDiagnostic[] | Promise<RawDiagnostic[]>`):
 *
 * 1. **Stack checks** — compiled modules shipped by the active stack at
 *    `{stackRoot}/dist/commands/lint/checks/{GROUP}/{id}.js`.
 * 2. **Project checks** — TypeScript/JavaScript modules authored by the
 *    project under `.dude/lint/checks/{GROUP}/{id}.ts`, loaded through
 *    **jiti** (same mechanism as `.dude/commands/`), so they can import
 *    packages installed in the project.
 *
 * The diagnostic code is derived from the path in both cases
 * (`checks/FE/001.* → FE001`). A code claimed by both the stack and the
 * project — or twice inside the project — is a hard error: project checks
 * extend the stack's rule set, they never shadow it. To drop a stack rule,
 * list its code in `dude.json` → `lint.disable`.
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import { createJiti } from 'jiti'
import type { Diagnostic, CheckFn } from './types.js'
import { formatDiagnostic } from './types.js'

/** Directory (relative to the project root) scanned for project lint checks. */
export const PROJECT_CHECKS_DIR = '.dude/lint/checks'

/** File extensions jiti can load as a project check module. */
const LOADABLE = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'])

export interface LintResult {
  diagnostics: Diagnostic[]
  errorCount: number
  warningCount: number
  /**
   * Non-fatal configuration remarks (e.g. a `lint.disable` entry that matches
   * no known check). Callers should surface them to the user.
   */
  notices: string[]
}

/** One discovered check: where it came from and how to load it. */
interface DiscoveredCheck {
  code: string
  file: string
  source: 'stack' | 'project'
  load: () => Promise<unknown>
}

/** Read `lint.disable` from the project's dude.json (missing bits → empty). */
function readDisabledCodes(root: string): Set<string> {
  const dudeJsonPath = path.join(root, 'dude.json')
  if (!existsSync(dudeJsonPath)) return new Set()
  const manifest = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as {
    lint?: { disable?: unknown }
  }
  const disable = manifest.lint?.disable
  if (!Array.isArray(disable)) return new Set()
  return new Set(disable.filter((c): c is string => typeof c === 'string'))
}

/** Group directories → check files, code derived as GROUP+id. */
function scanChecksDir(
  checksDir: string,
  extensions: Set<string>,
  toCheck: (group: string, id: string, filePath: string) => DiscoveredCheck,
): DiscoveredCheck[] {
  const found: DiscoveredCheck[] = []
  for (const groupEntry of readdirSync(checksDir, { withFileTypes: true })) {
    if (!groupEntry.isDirectory()) continue
    const group = groupEntry.name
    for (const fileEntry of readdirSync(path.join(checksDir, group), { withFileTypes: true })) {
      if (!fileEntry.isFile()) continue
      const ext = path.extname(fileEntry.name)
      if (!extensions.has(ext) || fileEntry.name.endsWith('.d.ts')) continue
      // Docs (`001.md`) and tests are ignored; only loadable modules count.
      const id = path.basename(fileEntry.name, ext)
      if (id.endsWith('.test')) continue
      found.push(toCheck(group, id, path.join(checksDir, group, fileEntry.name)))
    }
  }
  // Deterministic order: by code, then file (stable collision reporting).
  return found.sort((a, b) => a.code.localeCompare(b.code) || a.file.localeCompare(b.file))
}

/**
 * Run every stack check (from `{stackRoot}/dist/commands/lint/checks/`) and
 * every project check (from `{root}/.dude/lint/checks/`) against `root`,
 * injecting each diagnostic's code from the path it was discovered at.
 *
 * Throws when a code is defined twice — by both the stack and the project, or
 * by two project files. Codes listed in `dude.json` → `lint.disable` are
 * skipped entirely (never executed); a disabled code that matches no check
 * produces a notice instead of an error.
 */
export async function runLint(root: string, stackRoot: string): Promise<LintResult> {
  const stackChecksDir = path.join(stackRoot, 'dist', 'commands', 'lint', 'checks')

  if (!existsSync(stackChecksDir)) {
    throw new Error(
      `No lint checks directory found at:\n  ${stackChecksDir}\n` +
        `Did you build the stack? Try: pnpm --filter <stack> build`,
    )
  }

  const checks = scanChecksDir(stackChecksDir, new Set(['.js']), (group, id, filePath) => ({
    code: `${group}${id}`,
    file: filePath,
    source: 'stack' as const,
    load: () => import(pathToFileURL(filePath).href),
  }))

  // Project checks are authored as TS/JS and loaded through jiti, which
  // resolves their imports against the project's own node_modules.
  const projectChecksDir = path.join(root, PROJECT_CHECKS_DIR)
  if (existsSync(projectChecksDir)) {
    const jiti = createJiti(root)
    checks.push(
      ...scanChecksDir(projectChecksDir, LOADABLE, (group, id, filePath) => ({
        code: `${group}${id}`,
        file: filePath,
        source: 'project' as const,
        load: () => jiti.import(filePath),
      })),
    )
  }

  // Collision gate: every code must have exactly one definition. Project
  // checks may not shadow stack checks — disable the stack rule and re-add
  // the adapted one under a project-owned group instead.
  const claimed = new Map<string, DiscoveredCheck>()
  for (const check of checks) {
    const prior = claimed.get(check.code)
    if (prior) {
      const rel = (f: string) => path.relative(root, f)
      throw new Error(
        `Lint check code ${check.code} is defined twice:\n` +
          `  ${prior.source}:   ${rel(prior.file)}\n` +
          `  ${check.source}: ${rel(check.file)}\n` +
          `Project checks must use codes not claimed by the stack. To replace a ` +
          `stack rule, add its code to "lint.disable" in dude.json and define ` +
          `yours under a project-owned group (e.g. ${PROJECT_CHECKS_DIR}/PRJ/001.ts).`,
      )
    }
    claimed.set(check.code, check)
  }

  const disabled = readDisabledCodes(root)
  const notices: string[] = []
  for (const code of [...disabled].sort()) {
    if (!claimed.has(code)) {
      notices.push(
        `lint.disable lists "${code}" but no such check exists — remove it from dude.json.`,
      )
    }
  }

  const all: Diagnostic[] = []

  for (const check of checks) {
    if (disabled.has(check.code)) continue

    const mod = (await check.load()) as { default?: CheckFn }
    if (typeof mod.default !== 'function') {
      throw new Error(`Lint check ${check.code} (${check.file}) must export a default function.`)
    }

    const raw = await mod.default(root)
    for (const d of raw) {
      all.push({ ...d, code: check.code })
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
    notices,
  }
}

export { formatDiagnostic }
export type { Diagnostic }
