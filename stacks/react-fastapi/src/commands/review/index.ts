import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import { runLint, formatDiagnostic, type StackCommandDef } from '@cubocicloide/dude'

function isAvailable(cmd: string): boolean {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
  return r.error == null
}

function exec(cmd: string, args: string[], cwd: string): boolean {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  return r.status === 0 && r.error == null
}

function section(title: string) {
  const isTTY = process.stdout.isTTY
  const line = '─'.repeat(Math.max(0, 52 - title.length))
  const header = `── ${title} ${line}`
  process.stdout.write(isTTY ? `\n\x1b[1m${header}\x1b[0m\n` : `\n${header}\n`)
}

export const reviewCommand: StackCommandDef = {
  description: 'Run all checks: custom lint, ESLint, and API contract review.',
  async run({ projectRoot, stackRoot }) {
    const frontendDir = path.join(projectRoot, 'frontend')
    const isTTY = process.stdout.isTTY
    let ok = true

    // ── Preflight ─────────────────────────────────────────────────────────────
    const missing: string[] = []
    if (existsSync(frontendDir) && !isAvailable('pnpm'))
      missing.push('pnpm  →  https://pnpm.io/installation')
    if (missing.length > 0) {
      process.stderr.write('error: required tools not found on your PATH:\n\n')
      for (const m of missing) process.stderr.write(`  • ${m}\n`)
      process.stderr.write('\n')
      process.exit(1)
    }

    // ── 1. Custom lint ────────────────────────────────────────────────────────
    section('dude lint')
    const { diagnostics, errorCount } = await runLint(projectRoot, stackRoot)

    if (diagnostics.length === 0) {
      process.stdout.write('No issues found.\n')
    } else {
      const colorize = (s: string, severity: string) =>
        isTTY ? (severity === 'error' ? `\x1b[31m${s}\x1b[0m` : `\x1b[33m${s}\x1b[0m`) : s
      for (const d of diagnostics) {
        process.stdout.write(colorize(formatDiagnostic(d), d.severity) + '\n')
      }
    }
    ok = errorCount === 0 && ok

    // ── 2. ESLint ─────────────────────────────────────────────────────────────
    if (existsSync(frontendDir)) {
      section('eslint')
      ok = exec('pnpm', ['exec', 'eslint', 'src/'], frontendDir) && ok
    }

    // ── 3. API contract review ────────────────────────────────────────────────
    section('api review')
    ok = exec('dude', ['api', 'review'], projectRoot) && ok

    // ── Summary ───────────────────────────────────────────────────────────────
    process.stdout.write('\n')
    if (ok) {
      process.stdout.write(isTTY ? '\x1b[32mAll checks passed.\x1b[0m\n' : 'All checks passed.\n')
    } else {
      process.stderr.write(isTTY ? '\x1b[31mReview failed.\x1b[0m\n' : 'Review failed.\n')
      process.exit(1)
    }
  },
}
